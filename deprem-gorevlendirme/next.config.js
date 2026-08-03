/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'pdfkit', 'exceljs', 'docx', 'bcryptjs'],
  },
};

module.exports = nextConfig;
