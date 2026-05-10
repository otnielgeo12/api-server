import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { outletsTable } from "./outlets";

export const galleryImagesTable = pgTable("gallery_images", {
  id: serial("id").primaryKey(),
  outletId: integer("outlet_id").references(() => outletsTable.id, {
    onDelete: "set null",
  }),
  imagePath: text("image_path").notNull(),
  caption: text("caption"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertGalleryImageSchema = createInsertSchema(galleryImagesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGalleryImage = z.infer<typeof insertGalleryImageSchema>;
export type GalleryImage = typeof galleryImagesTable.$inferSelect;
