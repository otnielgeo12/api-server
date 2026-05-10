import { mysqlTable, int, varchar, text, boolean, timestamp } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { outletsTable } from "./outlets";

export const beveragesTable = mysqlTable("beverages", {
  id: int("id").primaryKey().autoincrement(),
  outletId: int("outlet_id")
    .notNull()
    .references(() => outletsTable.id, { onDelete: "cascade" }),
  category: varchar("category", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: varchar("price", { length: 50 }),
  sortOrder: int("sort_order").notNull().default(0),
  featured: boolean("featured").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .onUpdateNow(),
});

export const insertBeverageSchema = createInsertSchema(beveragesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBeverage = z.infer<typeof insertBeverageSchema>;
export type Beverage = typeof beveragesTable.$inferSelect;
