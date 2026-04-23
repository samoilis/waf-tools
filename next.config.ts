import type { NextConfig } from "next";

// Dynamically extract allowed dev origins from AUTH_URL
// Supports any proxy pattern (e.g. https://p3000.aroundweb.net)
function getAllowedDevOrigins(): string[] {
  const authUrl = process.env.AUTH_URL;
  if (!authUrl) return [];

  try {
    const { hostname } = new URL(authUrl);
    return [hostname];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: getAllowedDevOrigins(),
};

export default nextConfig;
