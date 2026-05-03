// Migration: Add from_location and to_location columns to inventory_movements
import mysql from "mysql2/promise";

const pool = mysql.createPool(process.env.DATABASE_URL);

async function migrate() {
  const conn = await pool.getConnection();
  try {
    // Add from_location column if not exists
    await conn.execute(`
      ALTER TABLE inventory_movements
      ADD COLUMN IF NOT EXISTS from_location VARCHAR(255) NULL,
      ADD COLUMN IF NOT EXISTS to_location VARCHAR(255) NULL
    `).catch(async (err) => {
      // MySQL older versions don't support IF NOT EXISTS for ADD COLUMN
      // Try each column separately
      for (const col of [
        "ALTER TABLE inventory_movements ADD COLUMN from_location VARCHAR(255) NULL",
        "ALTER TABLE inventory_movements ADD COLUMN to_location VARCHAR(255) NULL",
      ]) {
        await conn.execute(col).catch(e => {
          if (e.code === "ER_DUP_FIELDNAME") {
            console.log("Column already exists, skipping.");
          } else {
            throw e;
          }
        });
      }
    });
    console.log("✅ Migration done: from_location and to_location added to inventory_movements");
  } finally {
    conn.release();
    await pool.end();
  }
}

migrate().catch(err => { console.error("Migration failed:", err); process.exit(1); });
