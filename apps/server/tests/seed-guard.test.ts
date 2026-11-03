/**
 * The seed rewrites every content table and, asked to, deletes every
 * enquiry, booking and customer. It must never do that to a database that is
 * not this machine's by accident — only when the host is named outright.
 */

import { expect, test } from "bun:test";
import { seedRefusal } from "@CC-City-Chauffeurs/db/seed/guard";

const REMOTE = "postgresql://user:secret@ep-example-123.eu-west-2.aws.neon.tech/neondb?sslmode=require";

test("runs against a database on this machine, or a local container", () => {
  for (const url of [
    "postgresql://postgres:postgres@localhost:5432/app",
    "postgresql://postgres:postgres@127.0.0.1:5432/app",
    "postgresql://postgres:postgres@[::1]:5432/app",
    "postgresql://postgres:postgres@db:5432/app",
  ]) {
    expect(seedRefusal(url, undefined)).toBeNull();
  }
});

test("refuses any other host, and says how to name it", () => {
  const refusal = seedRefusal(REMOTE, undefined);
  expect(refusal).toContain("Refusing to seed ep-example-123.eu-west-2.aws.neon.tech");
  expect(refusal).toContain("SEED_DATABASE_HOST=ep-example-123.eu-west-2.aws.neon.tech");
  expect(refusal).not.toContain("secret");
});

test("runs against a remote host only when that exact host is named", () => {
  expect(seedRefusal(REMOTE, "ep-example-123.eu-west-2.aws.neon.tech")).toBeNull();
  expect(seedRefusal(REMOTE, "ep-other-456.eu-west-2.aws.neon.tech")).not.toBeNull();
  expect(seedRefusal(REMOTE, "yes")).not.toBeNull();
});

test("refuses when there is no address to check", () => {
  expect(seedRefusal(undefined, undefined)).not.toBeNull();
  expect(seedRefusal("not a url", undefined)).not.toBeNull();
});
