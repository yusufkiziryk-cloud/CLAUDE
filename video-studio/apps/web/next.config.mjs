/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@studio/ui",
    "@studio/domain",
    "@studio/prompt-engine",
    "@studio/timeline-engine",
  ],
};

export default nextConfig;
