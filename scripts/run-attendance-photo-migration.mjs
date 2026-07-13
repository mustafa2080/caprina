import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log("🔄 Running attendance photo/location migration...");

const cols = [
  ["check_in_photo", "TEXT NULL"],
  ["check_in_lat", "DOUBLE NULL"],
  ["check_in_lng", "DOUBLE NULL"],
  ["check_in_address", "VARCHAR(500) NULL"],
  ["check_out_photo", "TEXT NULL"],
  ["check_out_lat", "DOUBLE NULL"],
  ["check_out_lng", "DOUBLE NULL"],
  ["check_out_address", "VARCHAR(500) NULL"],
];

for (const [name, type] of cols) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) as cnt FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'attendance' AND column_name = ?`,
    [name]
  );
  if (rows[0].cnt > 0) {
    console.log(`⏭️  ${name} already exists, skipping`);
    continue;
  }
  await conn.execute(`ALTER TABLE attendance ADD COLUMN ${name} ${type}`);
  console.log(`✅ added ${name}`);
}

await conn.end();
console.log("✅ Migration complete!");
