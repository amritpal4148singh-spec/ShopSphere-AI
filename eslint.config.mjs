import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

/**
 * Layer boundaries from PRD section 9.3, enforced as lint rules so the
 * architecture is real in the codebase and not only described in docs.
 */
const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "coverage/**", "playwright-report/**", "test-results/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // components/: presentational only - must not fetch data or call services.
    files: ["src/components/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/services", "@/services/*"],
              message: "components/ must not import services/. Use a hook from hooks/ or a feature instead.",
            },
          ],
        },
      ],
    },
  },
  {
    // services/, lib/, utils/: framework-agnostic - must not import React or Next.js.
    files: ["src/services/**/*.{ts,tsx}", "src/lib/**/*.{ts,tsx}", "src/utils/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "react-dom/*", "next", "next/*"],
              message: "services/, lib/ and utils/ must not import React or Next.js (PRD 9.3).",
            },
          ],
        },
      ],
    },
  },
  {
    // features/*: must not reach into another feature's internals.
    // Import another feature only through its public entry: "@/features/<name>".
    files: ["src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*/*"],
              message: "Do not reach into another feature's internals. Import from '@/features/<name>' only.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
