import { ObjectStorageService } from "./src/lib/objectStorage.js";

async function main() {
  const service = new ObjectStorageService();
  
  // 1. Save dummy object
  const id = "test-image.webp";
  const content = Buffer.from("dummy-image-data-test");
  const mimeType = "image/webp";
  
  console.log("Saving object...");
  await service.saveObject(id, content, mimeType);
  
  // 2. Retrieve object
  console.log("Retrieving object...");
  const obj = await service.getObjectEntityFile("/objects/" + id);
  console.log("Retrieved:", obj);
  
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
