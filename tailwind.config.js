/* eslint-disable */

const range = require("lodash/range");
const fromPairs = require("lodash/fromPairs");
const merge = require("lodash/merge");
const defaultConfig = require("tailwindcss/defaultConfig");

const colors = {
  blue: {
    300: "#7885ff",
    400: "#4d5ffa",
    500: "#3d51ff",
    600: "#2d42fc",
    700: "#2e3dcd",
  },
  "cold-blue": {
    500: "#3a3f79",
    700: "#3a3f798f",
    900: "#181c27",
  },
  "pale-blue": {
    100: "rgba(180,187,255, 0.1)",
    600: "rgba(180,187,255, 0.6)",
  },
  slate: {
    100: "#a0a3c4",
    500: "#3e4361",
    600: "#373c58",
    700: "#23263b",
    800: "#1a202c",
    900: "#181c27",
    950: "#08091b",
  },
  gray: {
    50: "rgba(255, 255, 255, 0.95)",
    100: "rgba(255, 255, 255, 0.9)",
    200: "rgba(255, 255, 255, 0.8)",
    300: "rgba(255, 255, 255, 0.7)",
    400: "rgba(255, 255, 255, 0.6)",
    500: "rgba(255, 255, 255, 0.5)",
    600: "rgba(255, 255, 255, 0.4)",
    700: "rgba(255, 255, 255, 0.3)",
    800: "rgba(255, 255, 255, 0.2)",
    900: "rgba(255, 255, 255, 0.1)",
    950: "rgba(255, 255, 255, 0.05)",
  },
  yellow: {
    300: "#ffe166",
    500: "#f3b50c",
  },
  red: {
    400: "#ff637a",
    500: "#ff506a",
  },
  green: {
    300: "#56dba8",
    500: "#0ecc83",
  },
  white: "#ffffff",
  black: "#000000",
};

/**
 * @type {import('tailwindcss/types/config').PluginCreator}
 */
function injectColorsPlugin({ addBase, theme }) {
  function extractColorVars(colorObj, colorGroup = "") {
    return Object.keys(colorObj).reduce((vars, colorKey) => {
      const value = colorObj[colorKey];

      const visualColorKey = colorKey === "DEFAULT" ? "" : `-${colorKey}`;

      const newVars =
        typeof value === "string"
          ? { [`--color${colorGroup}${visualColorKey}`]: value }
          : extractColorVars(value, `-${colorKey}`);

      return { ...vars, ...newVars };
    }, {});
  }

  addBase({
    ":root": extractColorVars(theme("colors")),
  });
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    // @see https://tailwindcss.com/docs/customizing-spacing
    spacing: fromPairs(range(0, 96 + 1).map((spacing) => [spacing, `${spacing}px`])),
    borderRadius: merge(fromPairs(range(0, 96 + 1).map((borderRadius) => [borderRadius, `${borderRadius}px`])), {
      full: "9999px",
    }),
    fontSize: {
      12: "1.2rem",
      14: "1.4rem",
      15: "1.5rem",
      16: "1.6rem",
      24: "2.4rem",
      34: "3.4rem",
    },
    lineHeight: {
      1: "1",
      2: "2",
      // Normal is browser dependent. See https://developer.mozilla.org/en-US/docs/Web/CSS/line-height#normal
      base: "normal",
    },
    // @see https://tailwindcss.com/docs/customizing-colors
    colors: colors,
    textDecorationColor: colors,
    placeholderColor: {
      gray: "rgb(117, 117, 117)",
    },
    // @see https://tailwindcss.com/blog/tailwindcss-v3-2#max-width-and-dynamic-breakpoints
    // "these features will only be available if your project uses a simple screens configuration."
    // So we just copy the default screens config
    screens: defaultConfig.theme.screens,
    extend: {
      gridTemplateColumns: fromPairs(
        range(200, 501, 50).map((space) => [`auto-fill-${space}`, `repeat(auto-fill, minmax(${space}px, 1fr))`])
      ),
    },
  },
  plugins: [injectColorsPlugin],
};
