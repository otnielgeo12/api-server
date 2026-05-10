import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";
import dotenv from "dotenv";
import path from "path";

// Cari file .env di root (naik 2 tingkat dari lib/db)
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const pool = mysql.createPool({ uri: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema, mode: "default" });

export * from "./schema";
