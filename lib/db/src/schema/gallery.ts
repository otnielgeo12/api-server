import { mysqlTable, int, varchar, text, timestamp } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { outletsTable } from "./outlets";

export const galleryImagesTable = mysqlTable("gallery_images", {
  id: int("id").primaryKey().autoincrement(),
  outletId: int("outlet_id").references(() => outletsTable.id, {
    onDelete: "set null",
  }),
  imagePath: text("image_path").notNull(),
  caption: varchar("caption", { length: 255 }),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .onUpdateNow(),
});

export const insertGalleryImageSchema = createInsertSchema(galleryImagesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGalleryImage = z.infer<typeof insertGalleryImageSchema>;
export type GalleryImage = typeof galleryImagesTable.$inferSelect;
