import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { serializeForResponse as ser } from "../lib/serialize";
import {
  db,
  siteInfoTable,
  outletsTable,
  bannersTable,
  galleryImagesTable,
  menuItemsTable,
} from "@workspace/db";
import {
  GetSiteInfoResponse,
  UpdateSiteInfoBody,
  UpdateSiteInfoResponse,
  GetDashboardSummaryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function ensureSiteInfo() {
  const [existing] = await db.select().from(siteInfoTable).limit(1);
  if (existing) return existing;
  const [result] = await db
    .insert(siteInfoTable)
    .values({ brandName: "Avenue Hospitality Group" });
  
  const [created] = await db
    .select()
    .from(siteInfoTable)
    .where(eq(siteInfoTable.id, result.insertId));
    
  return created;
}

router.get("/site-info", async (_req, res): Promise<void> => {
  const row = await ensureSiteInfo();
  res.json(GetSiteInfoResponse.parse(ser(row)));
});

router.patch("/site-info", async (req, res): Promise<void> => {
  const parsed = UpdateSiteInfoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await ensureSiteInfo();
  await db
    .update(siteInfoTable)
    .set(parsed.data)
    .where(eq(siteInfoTable.id, existing.id));
    
  const [row] = await db
    .select()
    .from(siteInfoTable)
    .where(eq(siteInfoTable.id, existing.id));
    
  res.json(UpdateSiteInfoResponse.parse(ser(row)));
});

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [outletCountRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(outletsTable);
  const [menuCountRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(menuItemsTable);
  const [bannerCountRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(bannersTable);
  const [galleryCountRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(galleryImagesTable);

  const recentMenuItems = await db
    .select()
    .from(menuItemsTable)
    .orderBy(desc(menuItemsTable.createdAt))
    .limit(6);

  res.json(
    GetDashboardSummaryResponse.parse({
      outletCount: outletCountRow?.count ?? 0,
      menuItemCount: menuCountRow?.count ?? 0,
      bannerCount: bannerCountRow?.count ?? 0,
      galleryCount: galleryCountRow?.count ?? 0,
      recentMenuItems: ser(recentMenuItems),
    }),
  );
});

export default router;
