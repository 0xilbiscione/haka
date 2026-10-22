import type { Metadata } from "next";
import { StockDetail } from "@/components/StockDetail";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  return { title: code.toUpperCase() };
}

export default async function StockPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <StockDetail code={code.toUpperCase()} />;
}
