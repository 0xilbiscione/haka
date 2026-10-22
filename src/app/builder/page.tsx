import type { Metadata } from "next";
import { Builder } from "@/components/Builder";

export const metadata: Metadata = { title: "Racik screen" };

export default function BuilderPage() {
  return <Builder />;
}
