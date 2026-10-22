import type { Metadata } from "next";
import { Settings } from "@/components/Settings";

export const metadata: Metadata = {
  title: "Pengaturan",
  description: "Atur bahasa, tema, dan sumber data Haka.",
  alternates: { canonical: "/settings" },
  robots: { index: false, follow: true },
};

export default function SettingsPage() {
  return <Settings />;
}
