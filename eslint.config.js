
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import babelParser from "@babel/eslint-parser";

export default [
  {
    languageOptions: {

      parser: babelParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: "module",
        requireConfigFile: false,
        babelOptions: {
          presets: ["@babel/preset-react", "@babel/preset-env"],
        },
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    plugins: {
      react: pluginReact,
    },
    settings: {
      react: {
        version: "detect", // Automatically detect the React version
      },
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      ...pluginReact.configs.recommended.rules,
      // Add your custom rules here
      "react/prop-types": "off",
      "no-unused-vars": "off",
    },
  },
  {
    files: ["dist/**/*.js"], // Ignore linting for compiled JS files in dist
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-empty": "off",
      "no-cond-assign": "off",
      "no-prototype-builtins": "off",
      "no-control-regex": "off",
      "getter-return": "off",
      "valid-typeof": "off",
      "no-fallthrough": "off",
      "no-constant-condition": "off",
      "no-useless-escape": "off",
      "no-unreachable": "off",
    },
  },
];
