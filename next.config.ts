import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  turbopack: { root: process.cwd() },
  // Dev server is reached through an AWS Tunnel (Midway-gated) from the laptop;
  // Next 16 blocks cross-origin dev/HMR requests unless the host is listed.
  allowedDevOrigins: ["zhangnai-orbis.w.tunnels.lab.aws.dev"],
};

export default nextConfig;
