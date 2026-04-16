"use client";

import { MantineProvider } from "@mantine/core";
import { useState, useEffect } from "react";
import { buildTheme, theme as defaultTheme } from "@/theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState(defaultTheme);

  useEffect(() => {
    const saved = localStorage.getItem("waf-primary-color");
    if (saved) {
      setCurrentTheme(buildTheme(saved));
    }
  }, []);

  return (
    <MantineProvider theme={currentTheme} defaultColorScheme="auto">
      {children}
    </MantineProvider>
  );
}
