import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // After you create your Supabase project, update the hostname below to match
  // your project ref (Supabase → Settings → API → Project URL).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "rbcsvsixnhrdcazldnyf.supabase.co" },
    ],
  },
};

export default nextConfig;
