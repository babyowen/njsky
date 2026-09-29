import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // 页面禁缓存（数据页实时性优先）；API 路由自身已是 force-dynamic
  async headers() {
    return [
      {
        source: "/((?!api|_next/static|_next/image|images|icon.png).*)",
        headers: [{ key: "Cache-Control", value: "no-store, no-cache, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
