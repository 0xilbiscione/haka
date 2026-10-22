import { Suspense } from "react";
import { Screener } from "@/components/Screener";

export default function Home() {
  return (
    <Suspense>
      <Screener />
    </Suspense>
  );
}
