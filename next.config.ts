import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // `/` is canonical on this standalone site; keep the portal-style path working.
    return [{ source: "/available-players", destination: "/", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // The snapshot is replaced in place on each data update; always revalidate.
        source: "/data/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
