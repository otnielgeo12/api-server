import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
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
// Long cache TTL for images (1 year, since filenames include a UUID).
const CACHE_TTL_SEC = 60 * 60 * 24 * 365;

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
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
    console.error("Error generating upload URL", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file, CACHE_TTL_SEC);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as any);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error("Error serving public object", error);
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const response = await objectStorageService.downloadObject(objectFile, CACHE_TTL_SEC);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as any);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      console.warn("Object not found", error);
      res.status(404).json({ error: "Object not found" });
      return;
    }
    console.error("Error serving object", error);
    res.status(500).json({ error: "Failed to serve object" });
  }
});

/**
 * Collect the request body as a Buffer.
 */
function collectBody(req: Request): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * Returns true if the content-type indicates an image sharp can process.
 */
function isImageContentType(contentType: string): boolean {
  return /^image\/(jpeg|jpg|png|webp|gif|avif|tiff|bmp)/.test(contentType);
}

/**
 * Compress and convert an image buffer to WebP using sharp.
 * Resizes so neither dimension exceeds MAX_IMAGE_DIMENSION.
 */
async function optimizeImage(buffer: Buffer, contentType: string): Promise<Buffer> {
  if (!isImageContentType(contentType)) return buffer;
  try {
    return await sharp(buffer)
      .rotate()                              // auto-orient via EXIF
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer();
  } catch {
    // Fall back to original if sharp fails.
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

    // Store images as .webp; strip any existing image extension first.
    const storageId = isImage
      ? objectId.replace(/\.(jpe?g|png|gif|tiff?|bmp|avif|webp)$/i, "") + ".webp"
      : objectId;

    const fullPath = path.join(process.cwd(), "local-storage", storageId.replace(/^\/+/, ""));
    await fs.promises.writeFile(fullPath, finalBuffer);

    const etag = `"${crypto.createHash("md5").update(finalBuffer).digest("hex").slice(0, 16)}"`;
    console.info(`Upload saved: ${objectId} → ${storageId} (${rawBuffer.length}B → ${finalBuffer.length}B)`);

    res.set("ETag", etag);
    res.sendStatus(200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Upload failed for ${objectId}:`, msg);
    if (!res.headersSent) {
      res.status(500).json({ error: `Upload failed: ${msg}` });
    }
  }
};

/**
 * PUT & POST /upload-file/:objectId
 */
router.put("/upload-file/:objectId", handleLocalUpload);
router.post("/upload-file/:objectId", handleLocalUpload);

/**
 * GET /storage/local-upload/:objectId
 * Serve locally uploaded files with caching + ETag support.
 */
router.get("/storage/local-upload/:objectId", async (req: Request, res: Response) => {
  const objectId = req.params.objectId as string;
  const base = path.join(process.cwd(), "local-storage");

  // Try the exact path, then the .webp variant.
  const candidates = [
    path.join(base, objectId),
    path.join(base, objectId.replace(/\.(jpe?g|png|gif|tiff?|bmp|avif)$/i, "") + ".webp"),
    path.join(base, objectId + ".webp"),
  ];

  const fullPath = candidates.find(p => fs.existsSync(p));
  if (!fullPath) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  try {
    const stat = await fs.promises.stat(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      ".webp": "image/webp",
      ".jpg":  "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png":  "image/png",
      ".gif":  "image/gif",
      ".svg":  "image/svg+xml",
    };
    const contentType = contentTypeMap[ext] ?? "application/octet-stream";
    const etag = `"${crypto.createHash("md5").update(`${stat.mtimeMs}-${stat.size}`).digest("hex").slice(0, 16)}"`;

    res.set("ETag", etag);
    res.set("Cache-Control", `public, max-age=${CACHE_TTL_SEC}, immutable`);
    res.set("Content-Type", contentType);
    res.set("Content-Length", String(stat.size));

    if (req.headers["if-none-match"] === etag) {
      res.sendStatus(304);
      return;
    }

    res.sendFile(fullPath);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Failed to serve file: ${msg}` });
  }
});

export default router;
