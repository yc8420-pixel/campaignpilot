import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "sites/**/dist/**",
    "sites/campaignpilot-publish/**",
    "artifacts/**",
    "playwright-report/**",
    "test-results/**",
  ]),
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "@next/next/no-html-link-for-pages": "off",
    },
  },
]);
