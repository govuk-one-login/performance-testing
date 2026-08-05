import globals from "globals";

export default [
  {
    ignores: ["coverage/**"],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: globals.node,
    },
  },
];