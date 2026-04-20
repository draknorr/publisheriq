import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "PublisherIQ",
};

export default function Page() {
  return <LandingPage />;
}
