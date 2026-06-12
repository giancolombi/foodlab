import pg from "pg";

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/foodlab";

// Railway private Postgres uses SSL off; its public proxy presents a
// self-signed cert, hence "true" tolerates it. Use "verify" against a
// provider with a real CA-signed cert to get full TLS validation.
function sslConfig(): pg.PoolConfig["ssl"] {
  const mode = process.env.DATABASE_SSL;
  if (mode === "verify") return { rejectUnauthorized: true };
  if (mode === "true" || mode === "no-verify") {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

export const pool = new Pool({
  connectionString,
  ssl: sslConfig(),
});

pool.on("error", (err) => {
  console.error("Unexpected Postgres pool error", err);
});
