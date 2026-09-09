import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

/** @type {import('next').NextConfig} */
const nextConfig = (phase) => ({
  reactStrictMode: true,
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  outputFileTracingRoot: process.cwd(),
  // AGENTS.md is managed by the workspace and read-only; do not let Next.js rewrite it.
  agentRules: false,
  // The LAN dev server is commonly opened through loopback instead of the
  // hostname Next uses to initialize the server. Keep this dev-only and
  // limited to the exact local address that the operator uses.
  ...(phase === PHASE_DEVELOPMENT_SERVER
    ? { allowedDevOrigins: ['127.0.0.1'] }
    : {}),
});

export default nextConfig;
