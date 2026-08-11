import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "温油站务台",
  robots: { index: false, follow: false },
};

export default function StationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
