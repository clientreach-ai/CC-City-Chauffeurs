import { afterAll, beforeAll, expect, test } from "bun:test";
import { only, setTestEnvironment, startDatabase, type TestDatabase } from "./harness";

setTestEnvironment();
let database: TestDatabase;

beforeAll(async () => { database = await startDatabase(); });
afterAll(async () => { await database.stop(); });

test("the real migrations build the real schema", async () => {
  const tables = await database.client.query<{ count: number }>(
    "select count(*)::int as count from information_schema.tables where table_schema = 'public'",
  );
  expect(only(tables.rows).count).toBeGreaterThan(20);

  const sequence = await database.client.query<{ nextval: string }>(
    "select nextval('enquiry_reference_seq')",
  );
  expect(Number(only(sequence.rows).nextval)).toBe(1100);
});
