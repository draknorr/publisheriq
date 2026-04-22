"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type {
  TypedSupabaseClient,
  WaitlistInsert,
} from "@publisheriq/database";
import {
  AccessInput,
  AccessPrimaryButton,
  AccessSheetMessage,
  AccessTextarea,
  accessSmallText,
} from "@/components/landing/AccessShell";
import { createBrowserClient } from "@/lib/supabase/client";

interface AccessRequestFormProps {
  enterHref?: string;
}

export function AccessRequestForm({
  enterHref = "/login",
}: AccessRequestFormProps) {
  const searchParams = useSearchParams();

  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    organization: "",
    howIPlanToUse: "",
  });

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setFormData((prev) => ({ ...prev, email: emailParam }));
    }
  }, [searchParams]);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const supabase = createBrowserClient() as unknown as TypedSupabaseClient;
      const waitlistEntry: WaitlistInsert = {
        email: formData.email,
        full_name: formData.fullName,
        organization: formData.organization || null,
        how_i_plan_to_use: formData.howIPlanToUse || null,
        status: "pending",
      };

      const { error: insertError } = await supabase
        .from("waitlist")
        .insert(waitlistEntry);

      if (insertError && insertError.code !== "23505") {
        console.error("Waitlist error:", insertError);
      }

      setIsSuccess(true);
    } catch {
      setError(
        "We could not submit your request. Please try again in a moment.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="space-y-8">
        <AccessSheetMessage title="Request received">
          <p>We&apos;ll review it and reply by email.</p>
        </AccessSheetMessage>
        <Link
          href={enterHref}
          className={`${accessSmallText} inline-flex border-b border-[#171814]/35 pb-1.5 text-[#171814]/70 transition-colors hover:border-[#171814] hover:text-[#171814] focus-visible:border-[#171814] focus-visible:text-[#171814]`}
        >
          Enter
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      <AccessInput
        type="email"
        name="email"
        label="Work email"
        placeholder="name@company.com"
        value={formData.email}
        onChange={handleChange}
        required
        autoFocus
      />

      <AccessInput
        type="text"
        name="fullName"
        label="Name"
        placeholder="Your name"
        value={formData.fullName}
        onChange={handleChange}
        required
      />

      <AccessInput
        type="text"
        name="organization"
        label="Organization"
        placeholder="Company or studio"
        value={formData.organization}
        onChange={handleChange}
      />

      <AccessTextarea
        name="howIPlanToUse"
        label="Context"
        placeholder="Optional"
        value={formData.howIPlanToUse}
        onChange={handleChange}
      />

      {error ? (
        <p className="text-[0.82rem] leading-5 text-[#9a332c]">{error}</p>
      ) : null}

      <AccessPrimaryButton
        type="submit"
        isLoading={isLoading}
        disabled={!formData.email || !formData.fullName}
      >
        {isLoading ? "Submitting" : "Submit request"}
      </AccessPrimaryButton>
    </form>
  );
}

export function AccessRequestFallback() {
  return <AccessSheetMessage title="Loading request" />;
}
