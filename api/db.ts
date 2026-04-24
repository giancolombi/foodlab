import pg from "pg";

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/foodlab";

export const pool = new Pool({
  connectionString,
  // Railway private Postgres uses SSL off; public uses SSL. Allow override.
  ssl:
    process.env.DATABASE_SSL === "true"
      ? { rejectUnauthorized: false }
      : undefined,
});

pool.on("error", (err) => {
  console.error("Unexpected Postgres pool error", err);
});
