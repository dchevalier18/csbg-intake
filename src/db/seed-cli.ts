/* Reset + reseed the database from scratch: `npm run seed`
   Driver-agnostic: drops through the shared db handle, so it works against
   both PostgreSQL (postgres://) and the embedded engine (pglite://). */
import { sql, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { db, dbReady, dbResetBootstrap, databaseInfo } from "./index";

async function main(): Promise<void> {
  await dbReady(); // settle the first-boot gate before dropping
  const tables = Object.values(schema).filter((x) => is(x, PgTable)).map((x) => getTableName(x));
  for (const name of tables) {
    await db.execute(sql.raw(`DROP TABLE IF EXISTS "${name}" CASCADE`));
  }
  dbResetBootstrap();
  await dbReady(); // bootstrap recreates the schema and auto-seeds the empty DB
  const info = databaseInfo();
  console.log(`Seeded fresh database ${info.database} at ${info.host}:${info.port}`);
  console.log("Demo logins (password demo1234): dana, marcus, luz, robin, joan, terrence");
}

main().then(() => process.exit(0), (err) => { console.error(err); process.exit(1); });
