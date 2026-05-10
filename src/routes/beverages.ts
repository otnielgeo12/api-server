import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { serializeForResponse as ser } from "../lib/serialize";
import { db, beveragesTable, outletsTable } from "@workspace/db";
import {
  ListBeveragesParams,
  ListBeveragesResponse,
  CreateBeverageParams,
  CreateBeverageBody,
  GetBeverageParams,
  GetBeverageResponse,
  UpdateBeverageParams,
  UpdateBeverageBody,
  UpdateBeverageResponse,
  DeleteBeverageParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/outlets/:outletId/beverages", async (req, res): Promise<void> => {
  const params = ListBeveragesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(beveragesTable)
    .where(eq(beveragesTable.outletId, params.data.outletId))
    .orderBy(asc(beveragesTable.sortOrder), asc(beveragesTable.id));
  res.json(ListBeveragesResponse.parse(ser(rows)));
});

router.post("/outlets/:outletId/beverages", async (req, res): Promise<void> => {
  const params = CreateBeverageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateBeverageBody.safeParse(req.body);
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
    .insert(beveragesTable)
    .values({ ...parsed.data, outletId: params.data.outletId })
    .returning();
  res.status(201).json(GetBeverageResponse.parse(ser(row)));
});

router.get("/beverages/:id", async (req, res): Promise<void> => {
  const params = GetBeverageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(beveragesTable)
    .where(eq(beveragesTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Beverage not found" });
    return;
  }
  res.json(GetBeverageResponse.parse(ser(row)));
});

router.patch("/beverages/:id", async (req, res): Promise<void> => {
  const params = UpdateBeverageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateBeverageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(beveragesTable)
    .set(parsed.data)
    .where(eq(beveragesTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Beverage not found" });
    return;
  }
  res.json(UpdateBeverageResponse.parse(ser(row)));
});

router.delete("/beverages/:id", async (req, res): Promise<void> => {
  const params = DeleteBeverageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(beveragesTable)
    .where(eq(beveragesTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Beverage not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
