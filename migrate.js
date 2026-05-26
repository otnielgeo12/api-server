import fs from "fs";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

async function main() {
  const sql = fs.readFileSync("mysql_migration.sql", "utf-8");
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Split by semicolon and execute each statement
  const statements = sql.split(";").map((s) => s.trim()).filter((s) => s.length > 0);
  
  for (const statement of statements) {
    console.log("Executing:", statement.substring(0, 100) + "...");
    try {
      await connection.query(statement);
    } catch (err) {
      console.error("Error executing statement:", err.message);
    }
  }
  
  console.log("Migration finished.");
  await connection.end();
}

main().catch(console.error);
