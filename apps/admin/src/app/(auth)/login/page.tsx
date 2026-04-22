import { Suspense } from "react";
import { AccessShell } from "@/components/landing/AccessShell";
import {
  AccessLoginFallback,
  AccessLoginForm,
} from "@/components/landing/AccessLoginForm";

export default function LoginPage() {
  return (
    <AccessShell
      mode="enter"
      closeHref="/"
      enterHref="/login"
      requestHref="/waitlist"
    >
      <Suspense fallback={<AccessLoginFallback />}>
        <AccessLoginForm />
      </Suspense>
    </AccessShell>
  );
}
