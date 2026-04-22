import { Suspense } from "react";
import { AccessShell } from "@/components/landing/AccessShell";
import {
  AccessRequestFallback,
  AccessRequestForm,
} from "@/components/landing/AccessRequestForm";

export default function WaitlistPage() {
  return (
    <AccessShell
      mode="request"
      closeHref="/"
      enterHref="/login"
      requestHref="/waitlist"
    >
      <Suspense fallback={<AccessRequestFallback />}>
        <AccessRequestForm />
      </Suspense>
    </AccessShell>
  );
}
