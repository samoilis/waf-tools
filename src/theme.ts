import { createTheme, MantineColorsTuple } from "@mantine/core";

// Navy blue palette — 10 shades from lightest to darkest
const navy: MantineColorsTuple = [
  "#e8ecf4", // 0 - lightest (light theme backgrounds)
  "#c5cfe0", // 1
  "#9fb1cc", // 2
  "#7893b8", // 3
  "#5a7aaa", // 4
  "#3d6199", // 5 - primary (buttons, links)
  "#2d4f82", // 6 - header bg light
  "#1e3a66", // 7 - sidebar light
  "#152a4d", // 8 - dark theme surfaces
  "#0d1b33", // 9 - darkest (dark theme base)
];

export const theme = createTheme({
  primaryColor: "navy",
  defaultRadius: "md",
  colors: {
    navy,
  },
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  headings: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
});
