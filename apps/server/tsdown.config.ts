import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "./src/index.ts",
  format: "esm",
  outDir: "./dist",
  clean: true,
  /**
   * This is an application, not a library — nothing imports its types, and
   * generating them means resolving declarations for every workspace package
   * it pulls in. `check-types` already type-checks the source.
   */
  dts: false,
  deps: {
    alwaysBundle: [/@CC-City-Chauffeurs\/.*/],
  },
});
