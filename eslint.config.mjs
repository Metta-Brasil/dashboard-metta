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
    // Worktrees de agentes: cópias inteiras do repositório (com .next e
    // node_modules próprios). Sem isto o `eslint` varre todas e estoura a
    // memória do Node antes de terminar.
    ".claude/**",
  ]),
]);

export default eslintConfig;
