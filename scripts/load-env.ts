/**
 * Charge les variables d'environnement exactement comme Next.js :
 * .env.local, puis .env.development / .env.production, puis .env.
 * Ainsi le seed et les migrations voient les mêmes valeurs que le site.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", { info: () => {}, error: console.error });
