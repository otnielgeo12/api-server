import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const outletsTable = pgTable("outlets", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  address: text("address"),
  phone: text("phone"),
  hours: text("hours"),
  cuisine: text("cuisine"),
  accentColor: text("accent_color"),
  coverImagePath: text("cover_image_path"),
  cardImagePath: text("card_image_path"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertOutletSchema = createInsertSchema(outletsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOutlet = z.infer<typeof insertOutletSchema>;
export type Outlet = typeof outletsTable.$inferSelect;
