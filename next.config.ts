import type { NextConfig } from "next";

// Baked into both the server and the client bundle of one build, so a tab can tell it is stale.
const BUILD_ID = process.env.BUILD_ID ?? new Date().toISOString();

const nextConfig: NextConfig = {
  reactStrictMode: false,
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  turbopack: { root: process.cwd() },
  // Dev server is reached through an AWS Tunnel (Midway-gated) from the laptop;
  // Next 16 blocks cross-origin dev/HMR requests unless the host is listed.
  allowedDevOrigins: ["zhangnai-orbis.w.tunnels.lab.aws.dev"],
};

export default nextConfig;
