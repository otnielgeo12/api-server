import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { outletsTable } from "./outlets";

export const promotionsTable = pgTable("promotions", {
  id: serial("id").primaryKey(),
  outletId: integer("outlet_id")
    .notNull()
    .references(() => outletsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  imagePath: text("image_path"),
  ctaLabel: text("cta_label"),
  ctaHref: text("cta_href"),
  badge: text("badge"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertPromotionSchema = createInsertSchema(promotionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;
export type Promotion = typeof promotionsTable.$inferSelect;
