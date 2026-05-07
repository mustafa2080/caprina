import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log("🔄 Running attendance migration...");

await conn.execute(`
  CREATE TABLE IF NOT EXISTS attendance (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    profile_id   INT NOT NULL,
    date         VARCHAR(10) NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'present',
    check_in     VARCHAR(8),
    check_out    VARCHAR(8),
    late_minutes INT DEFAULT 0,
    deduction    DOUBLE NOT NULL DEFAULT 0,
    notes        TEXT,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_attendance_profile_date (profile_id, date),
    CONSTRAINT fk_att_profile FOREIGN KEY (profile_id)
      REFERENCES employee_profiles(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);
console.log("✅ attendance table ready");

await conn.execute(`
  CREATE TABLE IF NOT EXISTS payroll_adjustments (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    profile_id INT NOT NULL,
    month      VARCHAR(7) NOT NULL,
    type       VARCHAR(10) NOT NULL,
    amount     DOUBLE NOT NULL,
    reason     VARCHAR(500) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_adj_profile FOREIGN KEY (profile_id)
      REFERENCES employee_profiles(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);
console.log("✅ payroll_adjustments table ready");

await conn.end();
console.log("✅ Migration complete!");
