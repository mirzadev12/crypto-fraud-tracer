import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Submission artefacts, not application code. record-demo.js is a function
    // expression meant to be handed to a Playwright session, which the rules
    // here would flag as an unused expression.
    "docs/**",
  ]),
]);

export default eslintConfig;
