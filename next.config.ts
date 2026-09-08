import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Chrome Android WebOTP — without this, "Allow" can grant SMS
          // access and then drop the code on the floor.
          { key: "Permissions-Policy", value: "otp-credentials=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
