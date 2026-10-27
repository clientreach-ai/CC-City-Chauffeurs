/**
 * Where the links the API sends point.
 *
 * Every invitation link starts with ADMIN_URL. Left on its localhost default
 * in production, the API would boot and then email links nobody can open,
 * with nothing anywhere to say so — so production refuses it at boot.
 */

import { describe, expect, test } from "bun:test";
import { linkConfigProblems } from "@CC-City-Chauffeurs/env/links";

describe("ADMIN_URL", () => {
  test("is refused in production while it points at this machine", () => {
    for (const ADMIN_URL of ["http://localhost:3002", "http://127.0.0.1:3002", "http://[::1]:3002"]) {
      expect(linkConfigProblems({ NODE_ENV: "production", ADMIN_URL }).map((problem) => problem.path)).toEqual(["ADMIN_URL"]);
    }
  });

  test("a real address is fine in production; anything is fine elsewhere", () => {
    expect(linkConfigProblems({ NODE_ENV: "production", ADMIN_URL: "https://cc-city-chauffeurs-admin-ochre.vercel.app" })).toEqual([]);
    expect(linkConfigProblems({ NODE_ENV: "development", ADMIN_URL: "http://localhost:3002" })).toEqual([]);
    expect(linkConfigProblems({ NODE_ENV: "test", ADMIN_URL: "http://localhost:3002" })).toEqual([]);
  });
});
