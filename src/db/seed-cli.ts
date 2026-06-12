/* Reset + reseed the database from scratch: `npm run seed` */
import { Client } from "pg";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { databaseUrl, dbReady, databaseInfo } from "./index";

async function main(): Promise<void> {
  const tables = Object.values(schema).filter((x) => is(x, PgTable)).map((x) => getTableName(x));
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query(tables.map((name) => `DROP TABLE IF EXISTS ${name} CASCADE;`).join("\n"));
  await client.end();
  await dbReady(); // bootstrap recreates the schema and auto-seeds the empty DB
  const info = databaseInfo();
  console.log(`Seeded fresh database ${info.database} at ${info.host}:${info.port}`);
  console.log("Demo logins (password demo1234): dana, marcus, luz, robin, joan, terrence");
}

main().then(() => process.exit(0), (err) => { console.error(err); process.exit(1); });
