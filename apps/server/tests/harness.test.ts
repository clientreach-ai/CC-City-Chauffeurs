import { afterAll, beforeAll, expect, test } from "bun:test";
import { setTestEnvironment, startDatabase, type TestDatabase } from "./harness";

setTestEnvironment();
let database: TestDatabase;

beforeAll(async () => { database = await startDatabase(); });
afterAll(async () => { await database.stop(); });

test("the real migrations build the real schema", async () => {
  const tables = await database.client.query<{ count: number }>(
    "select count(*)::int as count from information_schema.tables where table_schema = 'public'",
  );
  expect(tables.rows[0].count).toBeGreaterThan(20);

  const sequence = await database.client.query<{ nextval: string }>(
    "select nextval('enquiry_reference_seq')",
  );
  expect(Number(sequence.rows[0].nextval)).toBe(1100);
});
