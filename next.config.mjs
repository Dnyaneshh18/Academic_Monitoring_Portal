/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
      serverComponentsExternalPackages: ["bcryptjs", "pdf-parse", "xlsx", "nodemailer", "pg"]
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("node:sqlite");
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" }
        ]
      }
    ];
  }
};

export default nextConfig;
