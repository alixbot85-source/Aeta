/** @type {import('next').NextConfig} */
const isGitHubPages = process.env.GITHUB_PAGES === "true";
const repositoryName = process.env.GITHUB_PAGES_REPOSITORY_NAME || "Aeta";
const basePath = isGitHubPages ? `/${repositoryName}` : "";

const nextConfig = {
  transpilePackages: ["@aeta/shared"],
  output: isGitHubPages ? "export" : undefined,
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: isGitHubPages,
  images: {
    unoptimized: true
  },
  experimental: {
    serverComponentsExternalPackages: []
  }
};

export default nextConfig;
