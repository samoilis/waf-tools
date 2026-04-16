"use client";

import { MantineProvider } from "@mantine/core";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { buildTheme, theme as defaultTheme } from "@/theme";

const STORAGE_KEY = "waf-primary-color";

const PrimaryColorContext = createContext<(color: string) => void>(() => {});

export function usePrimaryColor() {
  return useContext(PrimaryColorContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState(defaultTheme);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setCurrentTheme(buildTheme(saved));
    }
  }, []);

  const setPrimaryColor = useCallback((color: string) => {
    localStorage.setItem(STORAGE_KEY, color);
    setCurrentTheme(buildTheme(color));
  }, []);

  return (
    <PrimaryColorContext.Provider value={setPrimaryColor}>
      <MantineProvider theme={currentTheme} defaultColorScheme="auto">
        {children}
      </MantineProvider>
    </PrimaryColorContext.Provider>
  );
}
