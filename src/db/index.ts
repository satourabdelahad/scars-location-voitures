import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Connexion PostgreSQL (Neon en production, via la chaîne "pooled" -pooler).
 * Le pool est réutilisé entre les invocations à chaud des fonctions Netlify.
 */
const globalForDb = globalThis as unknown as { __scarPool?: Pool };

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant : copiez .env.example vers .env.local");
  const isLocal = /localhost|127\.0\.0\.1|\/var\/run/.test(url);
  return new Pool({
    connectionString: url,
    max: isLocal ? 10 : 5,
    idleTimeoutMillis: 10_000,
    ssl: isLocal ? undefined : { rejectUnauthorized: true },
  });
}

const pool = globalForDb.__scarPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.__scarPool = pool;

export const db = drizzle(pool, { schema, casing: "snake_case" });
export type DB = typeof db;
export { schema };
