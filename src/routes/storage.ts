import { Router, type IRouter, type Request, type Response } from "express";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as sharpModule from "sharp";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

// sharp ships as a CommonJS module; unwrap default if needed
const sharp = (sharpModule as any).default ?? sharpModule;

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// Max dimension for any side of an uploaded image (px).
const MAX_IMAGE_DIMENSION = 1920;
// WebP quality (0–100). 82 gives great quality at ~40–60% smaller than JPEG.
const WEBP_QUALITY = 82;
// Long cache TTL for images (1 year).
const CACHE_TTL_SEC = 60 * 60 * 24 * 365;

/**
 * Common handler for serving images with optional resizing.
 */
async function serveProcessedObject(req: Request, res: Response, filePath: string) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const isImage = [".webp", ".jpg", ".jpeg", ".png", ".gif", ".avif"].includes(ext);
    
    // Parse resize parameters
    const width = parseInt(req.query.w as string);
    const quality = parseInt(req.query.q as string) || WEBP_QUALITY;

    // Standard serving: Let Express handle everything (headers, ETag, MIME types, etc.)
    if (!isImage || isNaN(width) || ext === ".svg") {
      return res.sendFile(filePath, {
        maxAge: CACHE_TTL_SEC * 1000,
        immutable: true,
        setHeaders: (res, filePath) => {
          // If the file has no extension, it's likely an older uploaded image
          if (!path.extname(filePath)) {
            res.setHeader("Content-Type", "image/webp");
          }
        }
      });
    }

    // Dynamic Resizing Path
    const stat = await fs.promises.stat(filePath);
    // ETag must include width/quality to distinguish between different versions of the same file
    const etag = `"${crypto.createHash("md5").update(`${stat.mtimeMs}-${stat.size}-${width}-${quality}`).digest("hex").slice(0, 16)}"`;

    if (req.headers["if-none-match"] === etag) {
      return res.sendStatus(304);
    }

    const buffer = await fs.promises.readFile(filePath);
    try {
      const processed = await sharp(buffer)
        .resize({ 
          width: Math.min(width, MAX_IMAGE_DIMENSION), 
          withoutEnlargement: true,
          fit: "inside"
        })
        .webp({ quality })
        .toBuffer();

      res.set("ETag", etag);
      res.set("Cache-Control", `public, max-age=${CACHE_TTL_SEC}, immutable`);
      res.set("Content-Type", "image/webp");
      res.set("Content-Length", String(processed.length));
      res.send(processed);
    } catch (sharpError) {
      console.error(`Sharp error for ${filePath}:`, sharpError);
      // Fallback to original if processing fails
      res.sendFile(filePath, { maxAge: CACHE_TTL_SEC * 1000, immutable: true });
    }

  } catch (error) {
    console.error(`Error serving ${filePath}:`, error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to serve object" });
    }
  }
}

/**
 * POST /storage/uploads/request-url
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  try {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid upload request metadata" });
    }

    const { name, size, contentType } = parsed.data;
    const uploadURL = await objectStorageService.getObjectEntityUploadURL(name);
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    console.error("Upload URL generation failed:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  const raw = req.params.filePath;
  const filePath = Array.isArray(raw) ? raw.join("/") : raw;
  const file = await objectStorageService.searchPublicObject(filePath);
  if (!file) return res.status(404).json({ error: "Public asset not found" });
  
  await serveProcessedObject(req, res, file);
});

/**
 * GET /storage/objects/*
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    await serveProcessedObject(req, res, objectFile);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      return res.status(404).json({ error: "Object not found" });
    }
    console.error("Object serving failed:", error);
    res.status(500).json({ error: "Internal server error serving object" });
  }
});

function collectBody(req: Request): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function isImageContentType(contentType: string): boolean {
  return /^image\/(jpeg|jpg|png|webp|gif|avif|tiff|bmp)/.test(contentType);
}

async function optimizeImage(buffer: Buffer, contentType: string): Promise<Buffer> {
  if (!isImageContentType(contentType)) return buffer;
  try {
    return await sharp(buffer)
      .rotate()
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer();
  } catch {
    return buffer;
  }
}

const handleLocalUpload = async (req: Request, res: Response): Promise<void> => {
  const objectId = req.params.objectId as string;
  const contentType = ((req.headers["content-type"] as string) || "application/octet-stream")
    .split(";")[0]
    .trim();

  try {
    const rawBuffer = await collectBody(req);
    const isImage = isImageContentType(contentType);
    const finalBuffer = isImage ? await optimizeImage(rawBuffer, contentType) : rawBuffer;

    const storageId = isImage
      ? objectId.replace(/\.(jpe?g|png|gif|tiff?|bmp|avif|webp)$/i, "") + ".webp"
      : objectId;

    const fullPath = path.join(process.cwd(), "local-storage", storageId.replace(/^\/+/, ""));
    await fs.promises.writeFile(fullPath, finalBuffer);

    const etag = `"${crypto.createHash("md5").update(finalBuffer).digest("hex").slice(0, 16)}"`;
    res.set("ETag", etag);
    res.sendStatus(200);
  } catch (err: unknown) {
    console.error(`Upload save failed for ${objectId}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to save uploaded file" });
    }
  }
};

router.put("/upload-file/:objectId", handleLocalUpload);
router.post("/upload-file/:objectId", handleLocalUpload);

/**
 * GET /storage/local-upload/:objectId
 */
router.get("/storage/local-upload/:objectId", async (req: Request, res: Response) => {
  const objectId = req.params.objectId as string;
  const base = path.join(process.cwd(), "local-storage");

  const candidates = [
    path.join(base, objectId),
    path.join(base, objectId.replace(/\.(jpe?g|png|gif|tiff?|bmp|avif)$/i, "") + ".webp"),
    path.join(base, objectId + ".webp"),
  ];

  const fullPath = candidates.find(p => fs.existsSync(p));
  if (!fullPath) return res.status(404).json({ error: "Upload not found" });
  
  await serveProcessedObject(req, res, fullPath);
});

export default router;
