/* Reset + reseed the database from scratch: `npm run seed` */
import fs from "node:fs";
import path from "node:path";

const DB_PATH = process.env.CSBG_DB_PATH || path.join(process.cwd(), "data", "csbg.db");

for (const suffix of ["", "-wal", "-shm", "-journal"]) {
  const p = DB_PATH + suffix;
  if (fs.existsSync(p)) fs.rmSync(p);
}

// importing the connection bootstraps the schema and auto-seeds the empty DB
import("./index").then(() => {
  console.log(`Seeded fresh database at ${DB_PATH}`);
  console.log("Demo logins (password demo1234): dana, marcus, luz, robin, joan, terrence");
});
