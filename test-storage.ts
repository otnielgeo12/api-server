import { ObjectStorageService } from "./src/lib/objectStorage";

async function main() {
  const service = new ObjectStorageService();
  
  const id = "test-image.webp";
  const content = Buffer.from("dummy-image-data-test");
  const mimeType = "image/webp";
  
  console.log("Saving object...");
  await service.saveObject(id, content, mimeType);
  
  console.log("Retrieving object...");
  const obj = await service.getObjectEntityFile("/objects/" + id);
  console.log("Retrieved:", obj);
  
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
