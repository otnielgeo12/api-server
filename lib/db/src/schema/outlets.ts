import { mysqlTable, int, varchar, text, timestamp } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const outletsTable = mysqlTable("outlets", {
  id: int("id").primaryKey().autoincrement(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  tagline: varchar("tagline", { length: 255 }),
  description: text("description"),
  address: text("address"),
  phone: varchar("phone", { length: 50 }),
  hours: varchar("hours", { length: 255 }),
  cuisine: varchar("cuisine", { length: 100 }),
  accentColor: varchar("accent_color", { length: 20 }),
  coverImagePath: text("cover_image_path"),
  cardImagePath: text("card_image_path"),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .onUpdateNow(),
});

export const insertOutletSchema = createInsertSchema(outletsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOutlet = z.infer<typeof insertOutletSchema>;
export type Outlet = typeof outletsTable.$inferSelect;
