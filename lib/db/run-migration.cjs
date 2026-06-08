const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("No DATABASE_URL found");
    process.exit(1);
  }
  const connection = await mysql.createConnection(dbUrl);
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS \`storage_objects\` (
      \`id\` varchar(255) NOT NULL,
      \`content\` mediumblob NOT NULL,
      \`mime_type\` varchar(255) NOT NULL,
      \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    );
  `);
  console.log("Migration successful");
  process.exit(0);
}
main().catch(console.error);
