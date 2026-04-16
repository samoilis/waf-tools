import { createTheme, MantineColorsTuple } from "@mantine/core";

// Blue palette based on #1F32C4 — 10 shades from lightest to darkest
const navy: MantineColorsTuple = [
  "#edeef9", // 0 - lightest (light theme backgrounds)
  "#cfd4f2", // 1
  "#adb5e9", // 2
  "#8a96e0", // 3
  "#6777d7", // 4
  "#1F32C4", // 5 - primary (buttons, links)
  "#1c2db0", // 6 - header bg light
  "#18279b", // 7 - sidebar light
  "#142087", // 8 - dark theme surfaces
  "#0f1a73", // 9 - darkest (dark theme base)
];

export function buildTheme(primaryColor = "navy") {
  return createTheme({
    primaryColor,
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
}

export const theme = buildTheme();
