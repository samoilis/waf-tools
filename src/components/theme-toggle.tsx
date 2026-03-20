"use client";

import { ActionIcon, useMantineColorScheme, useComputedColorScheme } from "@mantine/core";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  const toggleColorScheme = () => {
    setColorScheme(computedColorScheme === "dark" ? "light" : "dark");
  };

  return (
    <ActionIcon
      onClick={toggleColorScheme}
      variant="default"
      size="lg"
      aria-label="Toggle color scheme"
    >
      <Sun size={18} className="light-hidden" />
      <Moon size={18} className="dark-hidden" />
    </ActionIcon>
  );
}
