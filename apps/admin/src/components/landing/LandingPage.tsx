import { Suspense } from "react";
import {
  AccessShell,
  type AccessMode,
} from "@/components/landing/AccessShell";
import {
  AccessLoginFallback,
  AccessLoginForm,
} from "@/components/landing/AccessLoginForm";
import {
  AccessRequestFallback,
  AccessRequestForm,
} from "@/components/landing/AccessRequestForm";

interface LandingPageProps {
  mode?: AccessMode | null;
}

export function LandingPage({ mode = null }: LandingPageProps) {
  return (
    <AccessShell mode={mode} closeHref="/">
      {mode === "enter" ? (
        <Suspense fallback={<AccessLoginFallback />}>
          <AccessLoginForm requestAccessTarget="home" />
        </Suspense>
      ) : null}
      {mode === "request" ? (
        <Suspense fallback={<AccessRequestFallback />}>
          <AccessRequestForm enterHref="/?access=enter" />
        </Suspense>
      ) : null}
    </AccessShell>
  );
}
