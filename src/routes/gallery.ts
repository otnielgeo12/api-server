import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { serializeForResponse as ser } from "../lib/serialize";
import { db, galleryImagesTable } from "@workspace/db";
import {
  ListGalleryImagesQueryParams,
  ListGalleryImagesResponse,
  CreateGalleryImageBody,
  UpdateGalleryImageParams,
  UpdateGalleryImageBody,
  UpdateGalleryImageResponse,
  DeleteGalleryImageParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/gallery", async (req, res): Promise<void> => {
  const query = ListGalleryImagesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const rows =
    query.data.outletId !== undefined
      ? await db
          .select()
          .from(galleryImagesTable)
          .where(eq(galleryImagesTable.outletId, query.data.outletId))
          .orderBy(asc(galleryImagesTable.sortOrder), asc(galleryImagesTable.id))
      : await db
          .select()
          .from(galleryImagesTable)
          .orderBy(asc(galleryImagesTable.sortOrder), asc(galleryImagesTable.id));
  res.json(ListGalleryImagesResponse.parse(ser(rows)));
});

router.post("/gallery", async (req, res): Promise<void> => {
  const parsed = CreateGalleryImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(galleryImagesTable)
    .values(parsed.data)
    .returning();
  res.status(201).json(UpdateGalleryImageResponse.parse(ser(row)));
});

router.patch("/gallery/:id", async (req, res): Promise<void> => {
  const params = UpdateGalleryImageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateGalleryImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(galleryImagesTable)
    .set(parsed.data)
    .where(eq(galleryImagesTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Gallery image not found" });
    return;
  }
  res.json(UpdateGalleryImageResponse.parse(ser(row)));
});

router.delete("/gallery/:id", async (req, res): Promise<void> => {
  const params = DeleteGalleryImageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(galleryImagesTable)
    .where(eq(galleryImagesTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Gallery image not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
