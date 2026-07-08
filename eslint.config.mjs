import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
    ".tailadmin-ref/**",
  ]),
  {
    files: [
      "src/context/**",
      "src/layout/**",
      "src/icons/**",
      "src/components/ecommerce/**",
      "src/components/calendar/**",
      "src/components/charts/**",
      "src/components/auth/**",
      "src/components/common/**",
      "src/components/example/**",
      "src/components/form/**",
      "src/components/header/**",
      "src/components/tables/**",
      "src/components/ui/**",
      "src/components/user-profile/**",
      "src/components/videos/**",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react/no-unescaped-entities": "off",
    },
  },
]);

export default eslintConfig;
