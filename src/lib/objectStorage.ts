import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";

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

export class ObjectStorageService {
  constructor() {}

  async searchPublicObject(filePath: string): Promise<string | null> {
    const fullPath = path.join(LOCAL_STORAGE_DIR, filePath);
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
    if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
    if (ext === ".gif") contentType = "image/gif";
    if (ext === ".webp") contentType = "image/webp";
    if (ext === ".svg") contentType = "image/svg+xml";

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": `public, max-age=${cacheTtlSec}`,
      "Content-Length": String(stat.size),
    };

    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const objectId = randomUUID();
    return `/api/storage/local-upload/${objectId}`;
  }

  async getObjectEntityFile(objectPath: string): Promise<string> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const objectId = objectPath.replace("/objects/", "");
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
