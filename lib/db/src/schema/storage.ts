import { mysqlTable, varchar, timestamp, customType } from "drizzle-orm/mysql-core";

const mediumblob = customType<{ data: Buffer; driverData: string }>({
  dataType() {
    return 'mediumblob';
  },
  toDriver(value: Buffer): string {
    return value.toString('binary');
  },
  fromDriver(value: string | Buffer): Buffer {
    if (Buffer.isBuffer(value)) return value;
    return Buffer.from(value, 'binary');
  },
});

export const storageObjectsTable = mysqlTable("storage_objects", {
  id: varchar("id", { length: 255 }).primaryKey(),
  content: mediumblob("content").notNull(),
  mimeType: varchar("mime_type", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
