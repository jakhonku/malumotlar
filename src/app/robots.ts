import type { MetadataRoute } from "next";

// Ichki axborot tizimi: qidiruv tizimlari indekslamasin
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
