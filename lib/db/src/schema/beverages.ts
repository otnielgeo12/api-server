import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { outletsTable } from "./outlets";

export const beveragesTable = pgTable("beverages", {
  id: serial("id").primaryKey(),
  outletId: integer("outlet_id")
    .notNull()
    .references(() => outletsTable.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: text("price"),
  sortOrder: integer("sort_order").notNull().default(0),
  featured: boolean("featured").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertBeverageSchema = createInsertSchema(beveragesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBeverage = z.infer<typeof insertBeverageSchema>;
export type Beverage = typeof beveragesTable.$inferSelect;
