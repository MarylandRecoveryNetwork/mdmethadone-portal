import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maryland Methadone Clinic Finder | marylandmethadone.help",
  description:
    "Find a Maryland methadone / opioid treatment program (OTP) now. See which clinics are accepting new patients today. MAT for opioid use disorder.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
