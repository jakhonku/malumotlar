import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Madaniyat vazirligi — ma’lumot yig‘ish",
    short_name: "MOTF Monitoring",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#1e40af",
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
