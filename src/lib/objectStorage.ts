import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import * as crypto from "node:crypto";
import { db, storageObjectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), "local-storage");

if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
  fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".svg":  "image/svg+xml",
};

/** Return true if path exists on disk. */
async function fileExists(p: string): Promise<boolean> {
  try {
    await fsPromises.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Given an original path, try that path first then a .webp variant,
 * since uploads are now compressed to WebP.
 */
async function resolveWithWebpFallback(fullPath: string): Promise<string | null> {
  if (await fileExists(fullPath)) return fullPath;

  const webpPath = fullPath.replace(/\.(jpe?g|png|gif|tiff?|bmp|avif)$/i, "") + ".webp";
  if (webpPath !== fullPath && await fileExists(webpPath)) return webpPath;

  const appended = fullPath + ".webp";
  if (await fileExists(appended)) return appended;

  return null;
}

export class ObjectStorageService {
  constructor() {}

  async saveObject(id: string, content: Buffer, mimeType: string): Promise<void> {
    await db.insert(storageObjectsTable).values({
      id,
      content,
      mimeType,
    });
  }

  async searchPublicObject(filePath: string): Promise<{ buffer: Buffer; mimeType: string } | string | null> {
    const fullPath = path.join(LOCAL_STORAGE_DIR, filePath.replace(/^\/+/, ""));
    // Always fallback to local storage for seed images
    const local = await resolveWithWebpFallback(fullPath);
    if (local) return local;

    return null; // Public objects are usually seed files or served via /api/upload-file logic
  }

  async downloadObject(filePath: string, cacheTtlSec: number = 3600): Promise<Response> {
    const stat = await fsPromises.stat(filePath);

    const nodeStream = fs.createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const ext = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

    const etag = `"${crypto.createHash("md5").update(`${stat.mtimeMs}-${stat.size}`).digest("hex").slice(0, 16)}"`;

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": `public, max-age=${cacheTtlSec}, immutable`,
      "Content-Length": String(stat.size),
      "ETag": etag,
      "Vary": "Accept",
    };

    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(_originalName?: string): Promise<string> {
    const objectId = randomUUID();
    return `/api/upload-file/${objectId}`;
  }

  async getObjectEntityFile(objectPath: string): Promise<{ buffer: Buffer; mimeType: string } | string> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const objectId = objectPath.replace("/objects/", "").replace(/^\/+/, "");

    // 1. Check DB first
    const rows = await db
      .select()
      .from(storageObjectsTable)
      .where(eq(storageObjectsTable.id, objectId))
      .limit(1);

    if (rows.length > 0) {
      return { buffer: rows[0].content, mimeType: rows[0].mimeType };
    }

    // 2. Check DB with .webp extension (if requested without)
    if (!objectId.endsWith('.webp')) {
      const webpRows = await db
        .select()
        .from(storageObjectsTable)
        .where(eq(storageObjectsTable.id, objectId + ".webp"))
        .limit(1);
      
      if (webpRows.length > 0) {
        return { buffer: webpRows[0].content, mimeType: webpRows[0].mimeType };
      }
    }

    // 3. Fallback to Local Storage for seed images
    const fullPath = path.join(LOCAL_STORAGE_DIR, objectId);
    const resolved = await resolveWithWebpFallback(fullPath);
    if (!resolved) throw new ObjectNotFoundError();
    return resolved;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.startsWith("/api/upload-file/")) {
      const id = rawPath.replace("/api/upload-file/", "");
      return `/objects/${id}`;
    }
    return rawPath;
  }
}
