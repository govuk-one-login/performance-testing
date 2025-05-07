import globals from "globals";

export default [
  {
    files: ["**/*.js"],
    languageOptions: { sourceType: "module", ecmaVersion: "latest" },
  },
  { languageOptions: { globals: globals.browser } },
];
