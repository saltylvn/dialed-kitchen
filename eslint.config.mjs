import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The Content Security Policy blocks inline style="" attributes in production
      // (docs/decisions/0006), so they silently do nothing there. Use CSS classes.
      "react/forbid-dom-props": [
        "error",
        {
          forbid: [
            {
              propName: "style",
              message:
                "Inline styles are blocked by the CSP in production. Use Tailwind classes (see components/ui/WheelPicker for sizes).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
