import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Backing store do `'use cache'` = Upstash Redis (cache-handler.cjs).
  // Necessário porque o objeto cacheado (~31MB) excede o limite de ~2MB
  // do Vercel Data Cache. Upstash REST aceita 10MB; gzip leva pra ~3MB.
  cacheHandlers: {
    default: require.resolve("./cache-handler.cjs"),
  },
};

export default nextConfig;
