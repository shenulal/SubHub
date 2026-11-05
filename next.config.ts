import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "path";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",

  // Transpile the submodule packages
  transpilePackages: ["packages/ui-registry"],

  // Image optimisation settings
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      // Vendor catalog logos
      { protocol: "https", hostname: "logo.clearbit.com" },
      {
        protocol: "https",
        hostname: "www.google.com",
        pathname: "/s2/favicons",
      },
    ],
  },

  // Baseline security headers (CSP is applied at the edge/CDN per docs/SECURITY-PRACTICES.md)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ]
            : []),
        ],
      },
    ];
  },

  // Pin the workspace root so Turbopack never walks parent folders (stray lockfiles in $HOME).
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,

  // Experimental features
  experimental: {
    // Server Actions optimisation
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },

  // Prevent duplicate recharts instances: resolve every recharts import to the root node_modules
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      recharts: path.resolve(__dirname, "node_modules/recharts"),
    };
    return config;
  },
};

export default withNextIntl(nextConfig);
