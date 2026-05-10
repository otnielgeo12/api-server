import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load .env secara eksplisit.
// Melihat dari struktur folder monorepo kamu sebelumnya, file .env ada di root.
// Karena file ini ada di lib/db, kita harus mundur 2 folder (../../)
config({ path: "../../.env" });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "mysql2",
  dbCredentials: {
    url: DATABASE_URL,
  },
});