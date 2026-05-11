import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";

const LOCAL_STORAGE_DIR = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..", "..", "local-storage");

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

export class ObjectStorageService {
  constructor() {}

  async searchPublicObject(filePath: string): Promise<string | null> {
    const fullPath = path.join(LOCAL_STORAGE_DIR, filePath.replace(/^\/+/, ""));
    try {
      await fsPromises.access(fullPath);
      return fullPath;
    } catch {
      return null;
    }
  }

  async downloadObject(filePath: string, cacheTtlSec: number = 3600): Promise<Response> {
    const stat = await fsPromises.stat(filePath);
    
    const nodeStream = fs.createReadStream(filePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    let ext = path.extname(filePath).toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === ".png") contentType = "image/png";
    else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    else if (ext === ".gif") contentType = "image/gif";
    else if (ext === ".webp") contentType = "image/webp";
    else if (ext === ".svg") contentType = "image/svg+xml";
    else if (filePath.includes("/objects/")) contentType = "image/jpeg"; // Fallback for existing extensionless objects

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": `public, max-age=${cacheTtlSec}`,
      "Content-Length": String(stat.size),
    };

    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(originalName?: string): Promise<string> {
    const ext = originalName ? path.extname(originalName) : "";
    const objectId = `${randomUUID()}${ext}`;
    return `/api/storage/local-upload/${objectId}`;
  }

  async getObjectEntityFile(objectPath: string): Promise<string> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const objectId = objectPath.replace("/objects/", "").replace(/^\/+/, "");
    const fullPath = path.join(LOCAL_STORAGE_DIR, objectId);
    try {
      await fsPromises.access(fullPath);
      return fullPath;
    } catch {
      throw new ObjectNotFoundError();
    }
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.startsWith("/api/storage/local-upload/")) {
      const id = rawPath.replace("/api/storage/local-upload/", "");
      return `/objects/${id}`;
    }
    return rawPath;
  }
}
