/**
 * Repair script: fixes files in local-storage that were saved
 * with multipart/form-data boundaries instead of pure binary.
 * 
 * These files have multiple parts (relativePath, name, type, file).
 * We need to find the part named "file" and extract the binary.
 */
import * as fs from "node:fs";
import * as path from "node:path";

const LOCAL_STORAGE = path.resolve(process.cwd(), "local-storage");

function extractFileFromMultipart(rawBuffer) {
  // Check if it starts with a multipart boundary
  const head = rawBuffer.subarray(0, 10).toString("ascii");
  if (!head.startsWith("------")) {
    return null; // Not multipart, skip
  }

  // Find the boundary (first line, ending at \r)
  const firstLineEnd = rawBuffer.indexOf(0x0d);
  if (firstLineEnd === -1) return null;
  const boundary = rawBuffer.subarray(0, firstLineEnd).toString("ascii").trim();

  // Search for the file part: name="file"
  const filePartMarker = Buffer.from('name="file"');
  const filePartPos = rawBuffer.indexOf(filePartMarker);
  if (filePartPos === -1) {
    // Try alternate: maybe the binary just follows the first \r\n\r\n after headers
    // Find all \r\n\r\n sequences and check if any is followed by image magic bytes
    let searchPos = 0;
    while (searchPos < rawBuffer.length - 4) {
      const idx = rawBuffer.indexOf("\r\n\r\n", searchPos);
      if (idx === -1) break;
      const contentStart = idx + 4;
      if (contentStart + 2 > rawBuffer.length) break;
      
      const b0 = rawBuffer[contentStart];
      const b1 = rawBuffer[contentStart + 1];
      // Check for JPEG, PNG, WebP, GIF
      if ((b0 === 0xFF && b1 === 0xD8) ||
          (b0 === 0x89 && b1 === 0x50) ||
          (b0 === 0x52 && b1 === 0x49) ||
          (b0 === 0x47 && b1 === 0x49)) {
        const closingBoundary = Buffer.from("\r\n" + boundary);
        const contentEnd = rawBuffer.indexOf(closingBoundary, contentStart);
        return contentEnd !== -1
          ? rawBuffer.subarray(contentStart, contentEnd)
          : rawBuffer.subarray(contentStart);
      }
      searchPos = idx + 4;
    }
    return null;
  }

  // Find the \r\n\r\n after the file part header
  const headerEnd = rawBuffer.indexOf("\r\n\r\n", filePartPos);
  if (headerEnd === -1) return null;

  const contentStart = headerEnd + 4;

  // Find the closing boundary after the file content
  const closingBoundary = Buffer.from("\r\n" + boundary);
  const contentEnd = rawBuffer.indexOf(closingBoundary, contentStart);

  return contentEnd !== -1
    ? rawBuffer.subarray(contentStart, contentEnd)
    : rawBuffer.subarray(contentStart);
}

const files = fs.readdirSync(LOCAL_STORAGE);
let fixed = 0;
let skipped = 0;
let errors = 0;

for (const file of files) {
  const fullPath = path.join(LOCAL_STORAGE, file);
  const stat = fs.statSync(fullPath);
  if (!stat.isFile()) continue;

  const buffer = fs.readFileSync(fullPath);
  const extracted = extractFileFromMultipart(buffer);

  if (extracted === null) {
    skipped++;
    continue;
  }

  // Verify the extracted content looks like an image
  const b = extracted;
  if (b.length < 4) {
    console.warn(`⚠️  ${file}: extracted content too small (${b.length} bytes), skipping`);
    errors++;
    continue;
  }

  const isJpeg = b[0] === 0xFF && b[1] === 0xD8;
  const isPng = b[0] === 0x89 && b[1] === 0x50;
  const isWebp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46;
  const isGif = b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46;

  if (!isJpeg && !isPng && !isWebp && !isGif) {
    console.warn(`⚠️  ${file}: extracted content header [${b[0].toString(16)} ${b[1].toString(16)} ${b[2].toString(16)} ${b[3].toString(16)}] doesn't look like a known image format, skipping`);
    errors++;
    continue;
  }

  const format = isJpeg ? "JPEG" : isPng ? "PNG" : isWebp ? "WebP" : "GIF";
  const sizeBefore = buffer.length;
  const sizeAfter = extracted.length;
  fs.writeFileSync(fullPath, extracted);
  fixed++;
  console.log(`✅ ${file}: ${format} ${sizeBefore} → ${sizeAfter} bytes (stripped ${sizeBefore - sizeAfter} bytes of multipart overhead)`);
}

console.log(`\nDone! Fixed: ${fixed}, Skipped (already OK): ${skipped}, Errors: ${errors}`);
