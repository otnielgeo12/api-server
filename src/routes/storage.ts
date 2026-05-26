import { Router, type IRouter, type Request, type Response } from "express";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// Max dimension for any side of an uploaded image (px).
const MAX_IMAGE_DIMENSION = 1920;
// WebP quality (0–100). 82 gives great quality at ~40–60% smaller than JPEG.
const WEBP_QUALITY = 82;
// Long cache TTL for images (1 year).
const CACHE_TTL_SEC = 60 * 60 * 24 * 365;

function detectMimeTypeSync(filePath: string): string {
  try {
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);
    
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return "image/jpeg";
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return "image/png";
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return "image/webp";
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return "image/gif";
  } catch (e) {
    // Ignore error, fallback
  }
  return "application/octet-stream";
}

/**
 * Lazy-load sharp to prevent module-level crashes if native dependencies are missing.
 */
async function getSharp() {
  try {
    const sharpModule = await import("sharp");
    return (sharpModule as any).default ?? sharpModule;
  } catch (err) {
    console.error("Failed to load sharp:", err);
    return null;
  }
}

/**
 * Common handler for serving images with optional resizing.
 */
async function serveProcessedObject(req: Request, res: Response, filePath: string) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const hasExtension = ext !== "";
    const isImage = hasExtension 
      ? [".webp", ".jpg", ".jpeg", ".png", ".gif", ".avif"].includes(ext)
      : true; // If no extension, assume it could be an image
    
    // Parse resize parameters
    const width = parseInt(req.query.w as string);
    const quality = parseInt(req.query.q as string) || WEBP_QUALITY;

    const sendOriginal = () => {
      const options: any = {
        maxAge: CACHE_TTL_SEC * 1000,
        immutable: true,
      };
      if (!hasExtension) {
        options.headers = {
          "Content-Type": detectMimeTypeSync(filePath)
        };
      }
      res.sendFile(filePath, options);
    };

    // Standard serving: Let Express handle everything (headers, ETag, MIME types, etc.)
    if (!isImage || isNaN(width) || ext === ".svg") {
      sendOriginal();
      return;
    }

    // Dynamic Resizing Path
    const sharp = await getSharp();
    if (!sharp) {
      return sendOriginal();
    }

    const stat = await fs.promises.stat(filePath);
    // ETag must include width/quality to distinguish between different versions of the same file
    const etag = `"${crypto.createHash("md5").update(`${stat.mtimeMs}-${stat.size}-${width}-${quality}`).digest("hex").slice(0, 16)}"`;

    if (req.headers["if-none-match"] === etag) {
      return res.sendStatus(304);
    }

    try {
      const buffer = await fs.promises.readFile(filePath);
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
      console.error(`Sharp processing error for ${filePath}:`, sharpError);
      sendOriginal();
    }

  } catch (error) {
    console.error(`Error serving processed object ${filePath}:`, error);
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
      console.warn("Invalid upload request body:", parsed.error.format());
      return res.status(400).json({ error: "Invalid metadata provided" });
    }

    const { name } = parsed.data;
    const uploadURL = await objectStorageService.getObjectEntityUploadURL(name);
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    return res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
      }),
    );
  } catch (error) {
    console.error("Upload URL generation failed:", error);
    return res.status(500).json({ error: "Could not generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) return res.status(404).json({ error: "Asset not found" });
    
    return await serveProcessedObject(req, res, file);
  } catch (error) {
    return res.status(500).json({ error: "Error searching asset" });
  }
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
    return await serveProcessedObject(req, res, objectFile);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      return res.status(404).json({ error: "Object not found" });
    }
    console.error("Object serving failed:", error);
    return res.status(500).json({ error: "Internal server error" });
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

/**
 * Extract the binary file content from a multipart/form-data body.
 * Handles multi-field bodies (relativePath, name, type, file) as sent by Uppy.
 * Returns the raw buffer unchanged if it's not multipart.
 */
function extractFromMultipart(rawBuffer: Buffer, rawContentType: string): { buffer: Buffer; detectedMime: string } {
  const isMultipart = rawContentType.includes("multipart/form-data") ||
    rawBuffer.subarray(0, 6).toString("ascii").startsWith("------");

  if (!isMultipart) {
    return { buffer: rawBuffer, detectedMime: rawContentType.split(";")[0].trim() };
  }

  // Find the boundary from the buffer (first line)
  const firstLineEnd = rawBuffer.indexOf(0x0d); // \r
  if (firstLineEnd === -1) {
    return { buffer: rawBuffer, detectedMime: "application/octet-stream" };
  }
  const boundary = rawBuffer.subarray(0, firstLineEnd).toString("ascii").trim();

  // Strategy 1: Look for the part named "file"
  const filePartMarker = Buffer.from('name="file"');
  const filePartPos = rawBuffer.indexOf(filePartMarker);
  if (filePartPos !== -1) {
    const headerEnd = rawBuffer.indexOf("\r\n\r\n", filePartPos);
    if (headerEnd !== -1) {
      const partHeaders = rawBuffer.subarray(filePartPos, headerEnd).toString("ascii");
      const ctMatch = partHeaders.match(/Content-Type:\s*([^\r\n]+)/i);
      const detectedMime = ctMatch ? ctMatch[1].trim() : "application/octet-stream";
      const contentStart = headerEnd + 4;
      const closingBoundary = Buffer.from("\r\n" + boundary);
      const contentEnd = rawBuffer.indexOf(closingBoundary, contentStart);
      const fileContent = contentEnd !== -1
        ? rawBuffer.subarray(contentStart, contentEnd)
        : rawBuffer.subarray(contentStart);
      return { buffer: fileContent, detectedMime };
    }
  }

  // Strategy 2: Scan for image magic bytes after any \r\n\r\n separator
  let searchPos = 0;
  while (searchPos < rawBuffer.length - 4) {
    const idx = rawBuffer.indexOf("\r\n\r\n", searchPos);
    if (idx === -1) break;
    const contentStart = idx + 4;
    if (contentStart + 4 > rawBuffer.length) break;

    const b0 = rawBuffer[contentStart];
    const b1 = rawBuffer[contentStart + 1];
    const b2 = rawBuffer[contentStart + 2];
    const b3 = rawBuffer[contentStart + 3];
    if ((b0 === 0xFF && b1 === 0xD8) ||           // JPEG
        (b0 === 0x89 && b1 === 0x50) ||           // PNG
        (b0 === 0x52 && b1 === 0x49 && b2 === 0x46 && b3 === 0x46) || // WebP (RIFF)
        (b0 === 0x47 && b1 === 0x49 && b2 === 0x46)) { // GIF
      const closingBoundary = Buffer.from("\r\n" + boundary);
      const contentEnd = rawBuffer.indexOf(closingBoundary, contentStart);
      const fileContent = contentEnd !== -1
        ? rawBuffer.subarray(contentStart, contentEnd)
        : rawBuffer.subarray(contentStart);
      const mimeMap: Record<number, string> = { 0xFF: "image/jpeg", 0x89: "image/png", 0x52: "image/webp", 0x47: "image/gif" };
      return { buffer: fileContent, detectedMime: mimeMap[b0] || "application/octet-stream" };
    }
    searchPos = idx + 4;
  }

  // Strategy 3: Fallback — use the first part's content
  const headerEnd = rawBuffer.indexOf("\r\n\r\n");
  if (headerEnd !== -1) {
    const contentStart = headerEnd + 4;
    const closingBoundary = Buffer.from("\r\n" + boundary);
    const contentEnd = rawBuffer.indexOf(closingBoundary, contentStart);
    const fileContent = contentEnd !== -1
      ? rawBuffer.subarray(contentStart, contentEnd)
      : rawBuffer.subarray(contentStart);
    return { buffer: fileContent, detectedMime: "application/octet-stream" };
  }

  return { buffer: rawBuffer, detectedMime: "application/octet-stream" };
}

const handleLocalUpload = async (req: Request, res: Response): Promise<void> => {
  const objectId = req.params.objectId as string;
  const rawContentType = (req.headers["content-type"] as string) || "application/octet-stream";
  const contentType = rawContentType.split(";")[0].trim();

  try {
    const rawBuffer = await collectBody(req);
    
    // Extract file content from multipart if needed
    const extracted = extractFromMultipart(rawBuffer, rawContentType);
    const fileBuffer = extracted.buffer;
    const effectiveMime = contentType.startsWith("image/") ? contentType : extracted.detectedMime;
    
    const isImage = /^image\/(jpe?g|jpg|png|webp|gif|avif|tiff|bmp)/.test(effectiveMime);
    
    let finalBuffer = fileBuffer;
    let finalId = objectId;

    if (isImage) {
      const sharp = await getSharp();
      if (sharp) {
        try {
          finalBuffer = await sharp(fileBuffer)
            .rotate()
            .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: "inside", withoutEnlargement: true })
            .webp({ quality: WEBP_QUALITY })
            .toBuffer();
          finalId = objectId.replace(/\.(jpe?g|png|gif|tiff?|bmp|avif|webp)$/i, "") + ".webp";
        } catch (e) {
          console.warn("Sharp optimization failed, using raw buffer:", e);
        }
      } else {
        const extMap: Record<string, string> = {
          "image/jpeg": ".jpg",
          "image/jpg": ".jpg",
          "image/png": ".png",
          "image/webp": ".webp",
          "image/gif": ".gif",
          "image/avif": ".avif"
        };
        const defaultExt = extMap[effectiveMime] || "";
        if (defaultExt) {
          finalId = objectId.replace(/\.(jpe?g|png|gif|tiff?|bmp|avif|webp)$/i, "") + defaultExt;
        }
      }
    }

    const fullPath = path.join(process.cwd(), "local-storage", finalId.replace(/^\/+/, ""));
    await fs.promises.writeFile(fullPath, finalBuffer);

    const etag = `"${crypto.createHash("md5").update(finalBuffer).digest("hex").slice(0, 16)}"`;
    res.set("ETag", etag);
    res.sendStatus(200);
    return;
  } catch (err: unknown) {
    console.error(`Upload save failed for ${objectId}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to save file" });
      return;
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
  if (!fullPath) return res.status(404).json({ error: "File not found" });
  
  return await serveProcessedObject(req, res, fullPath);
});

export default router;
