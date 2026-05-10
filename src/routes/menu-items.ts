import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { serializeForResponse as ser } from "../lib/serialize";
import { db, menuItemsTable, outletsTable } from "@workspace/db";
import {
  ListMenuItemsParams,
  ListMenuItemsResponse,
  CreateMenuItemParams,
  CreateMenuItemBody,
  GetMenuItemParams,
  GetMenuItemResponse,
  UpdateMenuItemParams,
  UpdateMenuItemBody,
  UpdateMenuItemResponse,
  DeleteMenuItemParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/outlets/:outletId/menu-items", async (req, res): Promise<void> => {
  const params = ListMenuItemsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(menuItemsTable)
    .where(eq(menuItemsTable.outletId, params.data.outletId))
    .orderBy(asc(menuItemsTable.sortOrder), asc(menuItemsTable.id));
  res.json(ListMenuItemsResponse.parse(ser(rows)));
});

router.post("/outlets/:outletId/menu-items", async (req, res): Promise<void> => {
  const params = CreateMenuItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateMenuItemBody.safeParse(req.body);
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
  const [result] = await db
    .insert(menuItemsTable)
    .values({ ...parsed.data, outletId: params.data.outletId });
    
  const [row] = await db
    .select()
    .from(menuItemsTable)
    .where(eq(menuItemsTable.id, result.insertId));
    
  res.status(201).json(GetMenuItemResponse.parse(ser(row)));
});

router.get("/menu-items/:id", async (req, res): Promise<void> => {
  const params = GetMenuItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(menuItemsTable)
    .where(eq(menuItemsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Menu item not found" });
    return;
  }
  res.json(GetMenuItemResponse.parse(ser(row)));
});

router.patch("/menu-items/:id", async (req, res): Promise<void> => {
  const params = UpdateMenuItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateMenuItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await db
    .update(menuItemsTable)
    .set(parsed.data)
    .where(eq(menuItemsTable.id, params.data.id));
    
  const [row] = await db
    .select()
    .from(menuItemsTable)
    .where(eq(menuItemsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Menu item not found" });
    return;
  }
  res.json(UpdateMenuItemResponse.parse(ser(row)));
});

router.delete("/menu-items/:id", async (req, res): Promise<void> => {
  const params = DeleteMenuItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(menuItemsTable)
    .where(eq(menuItemsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Menu item not found" });
    return;
  }

  await db
    .delete(menuItemsTable)
    .where(eq(menuItemsTable.id, params.data.id));

  res.sendStatus(204);
});

export default router;
