import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, bannersTable } from "@workspace/db";
import { serializeForResponse as ser } from "../lib/serialize";
import {
  ListBannersQueryParams,
  ListBannersResponse,
  CreateBannerBody,
  GetBannerParams,
  GetBannerResponse,
  UpdateBannerParams,
  UpdateBannerBody,
  UpdateBannerResponse,
  DeleteBannerParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/banners", async (req, res): Promise<void> => {
  const query = ListBannersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const rows = query.data.activeOnly
    ? await db
        .select()
        .from(bannersTable)
        .where(eq(bannersTable.active, true))
        .orderBy(asc(bannersTable.sortOrder), asc(bannersTable.id))
    : await db
        .select()
        .from(bannersTable)
        .orderBy(asc(bannersTable.sortOrder), asc(bannersTable.id));
  res.json(ListBannersResponse.parse(ser(rows)));
});

router.post("/banners", async (req, res): Promise<void> => {
  const parsed = CreateBannerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [result] = await db.insert(bannersTable).values(parsed.data);
  const [row] = await db.select().from(bannersTable).where(eq(bannersTable.id, result.insertId));
  res.status(201).json(GetBannerResponse.parse(ser(row)));
});

router.get("/banners/:id", async (req, res): Promise<void> => {
  const params = GetBannerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(bannersTable)
    .where(eq(bannersTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Banner not found" });
    return;
  }
  res.json(GetBannerResponse.parse(ser(row)));
});

router.patch("/banners/:id", async (req, res): Promise<void> => {
  const params = UpdateBannerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateBannerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await db
    .update(bannersTable)
    .set(parsed.data)
    .where(eq(bannersTable.id, params.data.id));
  
  const [row] = await db
    .select()
    .from(bannersTable)
    .where(eq(bannersTable.id, params.data.id));
    
  if (!row) {
    res.status(404).json({ error: "Banner not found" });
    return;
  }
  res.json(UpdateBannerResponse.parse(ser(row)));
});

router.delete("/banners/:id", async (req, res): Promise<void> => {
  const params = DeleteBannerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(bannersTable)
    .where(eq(bannersTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Banner not found" });
    return;
  }

  await db
    .delete(bannersTable)
    .where(eq(bannersTable.id, params.data.id));

  res.sendStatus(204);
});

export default router;
