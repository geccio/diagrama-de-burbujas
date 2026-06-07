/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfjs-dist optionally references the Node-only "canvas" package; the browser
  // build doesn't need it. Alias it away for Turbopack.
  turbopack: {
    resolveAlias: {
      canvas: "./lib/empty.js",
    },
  },
};

export default nextConfig;
