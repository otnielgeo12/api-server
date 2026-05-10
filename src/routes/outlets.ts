import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { serializeForResponse as ser } from "../lib/serialize";
import { db, outletsTable } from "@workspace/db";
import {
  ListOutletsResponse,
  CreateOutletBody,
  GetOutletParams,
  GetOutletResponse,
  UpdateOutletParams,
  UpdateOutletBody,
  UpdateOutletResponse,
  DeleteOutletParams,
  GetOutletBySlugParams,
  GetOutletBySlugResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/outlets", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(outletsTable)
    .orderBy(asc(outletsTable.sortOrder), asc(outletsTable.id));
  res.json(ListOutletsResponse.parse(ser(rows)));
});

router.post("/outlets", async (req, res): Promise<void> => {
  const parsed = CreateOutletBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(outletsTable).values(parsed.data).returning();
  res.status(201).json(GetOutletResponse.parse(ser(row)));
});

router.get("/outlets/by-slug/:slug", async (req, res): Promise<void> => {
  const params = GetOutletBySlugParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(outletsTable)
    .where(eq(outletsTable.slug, params.data.slug));
  if (!row) {
    res.status(404).json({ error: "Outlet not found" });
    return;
  }
  res.json(GetOutletBySlugResponse.parse(ser(row)));
});

router.get("/outlets/:id", async (req, res): Promise<void> => {
  const params = GetOutletParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(outletsTable)
    .where(eq(outletsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Outlet not found" });
    return;
  }
  res.json(GetOutletResponse.parse(ser(row)));
});

router.patch("/outlets/:id", async (req, res): Promise<void> => {
  const params = UpdateOutletParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateOutletBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(outletsTable)
    .set(parsed.data)
    .where(eq(outletsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Outlet not found" });
    return;
  }
  res.json(UpdateOutletResponse.parse(ser(row)));
});

router.delete("/outlets/:id", async (req, res): Promise<void> => {
  const params = DeleteOutletParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(outletsTable)
    .where(eq(outletsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Outlet not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
