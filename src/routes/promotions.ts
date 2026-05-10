import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { serializeForResponse as ser } from "../lib/serialize";
import { db, promotionsTable, outletsTable } from "@workspace/db";
import {
  ListPromotionsParams,
  ListPromotionsQueryParams,
  ListPromotionsResponse,
  CreatePromotionParams,
  CreatePromotionBody,
  GetPromotionParams,
  GetPromotionResponse,
  UpdatePromotionParams,
  UpdatePromotionBody,
  UpdatePromotionResponse,
  DeletePromotionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/outlets/:outletId/promotions", async (req, res): Promise<void> => {
  const params = ListPromotionsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const query = ListPromotionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const conditions = query.data.activeOnly
    ? and(
        eq(promotionsTable.outletId, params.data.outletId),
        eq(promotionsTable.active, true),
      )
    : eq(promotionsTable.outletId, params.data.outletId);
  const rows = await db
    .select()
    .from(promotionsTable)
    .where(conditions)
    .orderBy(asc(promotionsTable.sortOrder), asc(promotionsTable.id));
  res.json(ListPromotionsResponse.parse(ser(rows)));
});

router.post("/outlets/:outletId/promotions", async (req, res): Promise<void> => {
  const params = CreatePromotionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreatePromotionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [outlet] = await db
    .select()
    .from(outletsTable)
    .where(eq(outletsTable.id, params.data.outletId));
  if (!outlet) {
    res.status(404).json({ error: "Outlet not found" });
    return;
  }
  const [row] = await db
    .insert(promotionsTable)
    .values({ ...parsed.data, outletId: params.data.outletId })
    .returning();
  res.status(201).json(GetPromotionResponse.parse(ser(row)));
});

router.get("/promotions/:id", async (req, res): Promise<void> => {
  const params = GetPromotionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(promotionsTable)
    .where(eq(promotionsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Promotion not found" });
    return;
  }
  res.json(GetPromotionResponse.parse(ser(row)));
});

router.patch("/promotions/:id", async (req, res): Promise<void> => {
  const params = UpdatePromotionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdatePromotionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(promotionsTable)
    .set(parsed.data)
    .where(eq(promotionsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Promotion not found" });
    return;
  }
  res.json(UpdatePromotionResponse.parse(ser(row)));
});

router.delete("/promotions/:id", async (req, res): Promise<void> => {
  const params = DeletePromotionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(promotionsTable)
    .where(eq(promotionsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Promotion not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
