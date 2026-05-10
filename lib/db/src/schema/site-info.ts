import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const siteInfoTable = pgTable("site_info", {
  id: serial("id").primaryKey(),
  brandName: text("brand_name").notNull(),
  tagline: text("tagline"),
  about: text("about"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  instagramUrl: text("instagram_url"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertSiteInfoSchema = createInsertSchema(siteInfoTable).omit({
  id: true,
  updatedAt: true,
});
export type InsertSiteInfo = z.infer<typeof insertSiteInfoSchema>;
export type SiteInfo = typeof siteInfoTable.$inferSelect;
