/**
 * The privacy notice and the terms of service, edited in the admin.
 *
 * What must hold: the website always has a complete page (the default
 * wording until something is saved, and again after a reset); a saved
 * version is tidied and checked by the same rules the admin form runs; only
 * a role that may change the business settings may change legal text; and
 * the public read never carries who saved it.
 */

import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import type { LegalDocumentContent } from "@CC-City-Chauffeurs/core";
import { Hono } from "hono";

import { setTestEnvironment, startDatabase, type TestDatabase } from "./harness";

setTestEnvironment();

let database: TestDatabase;
let legal: typeof import("../src/repositories/legal");
let core: typeof import("@CC-City-Chauffeurs/core");
let app: Hono;

beforeAll(async () => {
  database = await startDatabase();
  legal = await import("../src/repositories/legal");
  core = await import("@CC-City-Chauffeurs/core");

  const { legalRoutes } = await import("../src/routes/legal");
  const { publicRoutes } = await import("../src/routes/public");
  const { errorResponse } = await import("../src/lib/errors");

  // The admin routes behind a stand-in session: the role comes from a header.
  app = new Hono();
  app.onError((error, c) => errorResponse(error, c));
  const admin = new Hono<{ Variables: { user: unknown } }>()
    .use(async (c, next) => {
      const role = c.req.header("x-test-role");
      c.set("user", role ? { id: "u1", name: "Faheem", email: "f@example.test", image: null, role } : null);
      await next();
    })
    .route("/", legalRoutes as unknown as Hono);
  app.route("/api/admin", admin);
  app.route("/api/public", publicRoutes);
}, 60_000);

afterAll(async () => {
  await database.stop();
});

beforeEach(async () => {
  await database.client.exec("truncate table legal_document;");
});

const edited = (): LegalDocumentContent => ({
  title: "  Privacy notice  ",
  summary: "How we look after what you tell us.",
  sections: [
    { heading: "Who we are", paragraphs: ["CC City Chauffeurs Ltd.", "   "], points: [] },
    { heading: "Your rights", paragraphs: [], points: ["Access", "", "Deletion"] },
  ],
});

const put = (id: string, role: string | null, body: unknown) =>
  app.request(`/api/admin/legal/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(role ? { "x-test-role": role } : {}) },
    body: JSON.stringify(body),
  });

test("with nothing saved, both documents are the default wording", async () => {
  const all = await legal.getLegalDocuments();
  expect(all.map((doc) => doc.id)).toEqual(["privacy", "terms"]);
  for (const doc of all) {
    expect(doc.isDefault).toBe(true);
    expect(doc.updatedAt).toBeNull();
    expect(doc.title).toBe(core.defaultLegalDocuments[doc.id].title);
    expect(doc.sections.length).toBeGreaterThan(5);
  }
});

test("every default passes the rules an editor's version must meet", () => {
  for (const id of core.LEGAL_DOCUMENT_IDS) {
    expect(core.validateLegalDocument(core.defaultLegalDocuments[id])).toEqual({});
  }
});

test("a saved version is tidied, stored with its author, and served instead of the default", async () => {
  const saved = await legal.updateLegalDocument("privacy", edited(), "Faheem");
  expect(saved.isDefault).toBe(false);
  expect(saved.title).toBe("Privacy notice");
  expect(saved.updatedBy).toBe("Faheem");
  expect(saved.updatedAt).not.toBeNull();
  // Blank paragraphs and points are dropped rather than printed as gaps.
  expect(saved.sections[0]?.paragraphs).toEqual(["CC City Chauffeurs Ltd."]);
  expect(saved.sections[1]?.points).toEqual(["Access", "Deletion"]);

  // Saving again replaces the version rather than adding a second.
  await legal.updateLegalDocument("privacy", { ...edited(), summary: "Second version." }, "Faheem");
  expect((await legal.getLegalDocument("privacy")).summary).toBe("Second version.");
  expect((await database.client.query("select count(*)::int as n from legal_document")).rows).toEqual([{ n: 1 }]);

  // The other document is untouched.
  expect((await legal.getLegalDocument("terms")).isDefault).toBe(true);
});

test("an incomplete version is refused, field by field", async () => {
  const broken: LegalDocumentContent = {
    title: "",
    summary: "",
    sections: [{ heading: "", paragraphs: [" "], points: [] }],
  };
  await expect(legal.updateLegalDocument("terms", broken, "Faheem")).rejects.toMatchObject({
    fields: {
      title: expect.any(String),
      summary: expect.any(String),
      "sections.0.heading": expect.any(String),
      "sections.0.paragraphs": expect.any(String),
    },
  });
  await expect(
    legal.updateLegalDocument("terms", { title: "Terms", summary: "Terms.", sections: [] }, "Faheem"),
  ).rejects.toMatchObject({ fields: { sections: expect.any(String) } });
  expect((await legal.getLegalDocument("terms")).isDefault).toBe(true);
});

test("a reset brings the default wording back", async () => {
  await legal.updateLegalDocument("terms", edited(), "Faheem");
  const reset = await legal.resetLegalDocument("terms");
  expect(reset.isDefault).toBe(true);
  expect(reset.title).toBe(core.defaultLegalDocuments.terms.title);
});

test("only the two documents exist", async () => {
  await expect(legal.getLegalDocument("cookies")).rejects.toThrow("could not be found");
  const response = await app.request("/api/public/legal/cookies");
  expect(response.status).toBe(404);
});

test("changing legal text needs the settings capability; reading it does not", async () => {
  expect((await put("privacy", null, edited())).status).toBe(401);
  expect((await put("privacy", "editor", edited())).status).toBe(403);
  expect((await put("privacy", "manager", edited())).status).toBe(403);
  expect((await legal.getLegalDocument("privacy")).isDefault).toBe(true);

  const ok = await put("privacy", "admin", edited());
  expect(ok.status).toBe(200);
  expect(((await ok.json()) as { updatedBy: string }).updatedBy).toBe("Faheem");

  const read = await app.request("/api/admin/legal", { headers: { "x-test-role": "editor" } });
  expect(read.status).toBe(200);

  const reset = await app.request("/api/admin/legal/privacy", { method: "DELETE", headers: { "x-test-role": "editor" } });
  expect(reset.status).toBe(403);
});

test("a malformed body is refused before it reaches the rules", async () => {
  const response = await put("privacy", "admin", { title: "x", summary: "y", sections: "not a list" });
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(response.status).toBeLessThan(500);
});

test("the website's read carries the text and the date, never who saved it", async () => {
  await legal.updateLegalDocument("privacy", edited(), "Faheem");
  const response = await app.request("/api/public/legal/privacy");
  expect(response.status).toBe(200);
  const body = (await response.json()) as Record<string, unknown>;
  expect(body.title).toBe("Privacy notice");
  expect(body.updatedAt).toEqual(expect.any(String));
  expect(body).not.toHaveProperty("updatedBy");
  expect(body).not.toHaveProperty("isDefault");
});

test("before migration 0005 reaches a database, the pages serve the default and saving says why it cannot", async () => {
  await database.client.exec("alter table legal_document rename to legal_document_parked;");
  try {
    const doc = await legal.getLegalDocument("privacy");
    expect(doc.isDefault).toBe(true);
    expect((await legal.getLegalDocuments()).length).toBe(2);
    expect((await app.request("/api/public/legal/terms")).status).toBe(200);

    const save = await put("privacy", "admin", edited());
    expect(save.status).toBe(409);
    expect(((await save.json()) as { error: string }).error).toContain("migration 0005");

    expect((await legal.resetLegalDocument("privacy")).isDefault).toBe(true);
  } finally {
    await database.client.exec("alter table legal_document_parked rename to legal_document;");
  }
});
