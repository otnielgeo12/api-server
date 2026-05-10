import { mysqlTable, int, varchar, text, timestamp } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const siteInfoTable = mysqlTable("site_info", {
  id: int("id").primaryKey().autoincrement(),
  brandName: varchar("brand_name", { length: 255 }).notNull(),
  tagline: varchar("tagline", { length: 255 }),
  about: text("about"),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  instagramUrl: text("instagram_url"),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .onUpdateNow(),
});

export const insertSiteInfoSchema = createInsertSchema(siteInfoTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertSiteInfo = z.infer<typeof insertSiteInfoSchema>;
export type SiteInfo = typeof siteInfoTable.$inferSelect;
