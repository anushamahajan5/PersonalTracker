import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

const nextConfigWithAllowedOrigins: NextConfig = {
  ...nextConfig,
  allowedDevOrigins: ['192.168.1.4'],
};

export default nextConfigWithAllowedOrigins;
