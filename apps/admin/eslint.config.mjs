import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Next's recommended rules — Core Web Vitals, React hooks, accessibility and
 * TypeScript. Run with `pnpm lint` here or `pnpm turbo run lint` at the root.
 */
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // A leading underscore marks a name as deliberately unused — most often
      // a field dropped by destructuring: `const { id: _id, ...input } = row`.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
