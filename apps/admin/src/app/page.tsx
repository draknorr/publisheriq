import type { Metadata } from "next";
import type { AccessMode } from "@/components/landing/AccessShell";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "PublisherIQ",
};

function parseAccessMode(value: string | string[] | undefined): AccessMode | null {
  const access = Array.isArray(value) ? value[0] : value;
  return access === "enter" || access === "request" ? access : null;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ access?: string | string[] }>;
}) {
  const params = await searchParams;
  return <LandingPage mode={parseAccessMode(params.access)} />;
}
