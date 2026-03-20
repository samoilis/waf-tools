import type { NextConfig } from "next";

const codespaceUrl = process.env.CODESPACE_NAME
  ? `${process.env.CODESPACE_NAME}-3000.app.github.dev`
  : undefined;

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: codespaceUrl ? [codespaceUrl] : [],
};

export default nextConfig;
