import type { Metadata } from "next";
import { ColorSchemeScript, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { theme } from "@/theme";

import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Imperva WAF Tools",
  description: "Management tools for Imperva Web Application Firewall",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript />
      </head>
      <body suppressHydrationWarning>
        <MantineProvider theme={theme} defaultColorScheme="auto">
          <Notifications />
          <AuthProvider>
            <QueryProvider>{children}</QueryProvider>
          </AuthProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
