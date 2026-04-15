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
    // k6 load test scripts — CommonJS Node.js, not part of Next.js build
    "load-tests/**",
    // GSD worktree copies — orphaned snapshots used by parallel executors
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
