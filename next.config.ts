import type { NextConfig } from "next";

// The engine in lib/gemhog is NodeNext ESM with explicit .js specifiers so the
// compiled CLI runs on plain Node. Turbopack takes those specifiers literally,
// so the site builds with webpack (see the dev/build scripts) and maps them
// back to the .ts sources here.
const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    // /docs renders the markdown files from docs/ as bundled strings.
    config.module.rules.push({ test: /\.md$/, type: "asset/source" });
    return config;
  },
};

export default nextConfig;
