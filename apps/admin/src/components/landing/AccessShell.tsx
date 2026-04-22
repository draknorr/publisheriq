import Link from "next/link";
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

export type AccessMode = "enter" | "request";

const arrow = "\u2192";

export const accessSmallText =
  "font-mono text-[0.72rem] leading-none tracking-[0.055em] text-[#171814]";

const accessLabelText =
  "font-mono text-[0.68rem] leading-none tracking-[0.07em] text-[#171814]/55";

interface AccessShellProps {
  mode?: AccessMode | null;
  closeHref?: string;
  enterHref?: string;
  requestHref?: string;
  children?: ReactNode;
}

interface AccessInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

interface AccessTextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

interface AccessPrimaryButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
}

export function AccessShell({
  mode = null,
  closeHref = "/",
  enterHref = "/?access=enter",
  requestHref = "/?access=request",
  children,
}: AccessShellProps) {
  return (
    <main
      className="relative min-h-screen-safe overflow-x-hidden overflow-y-auto bg-[#f7f5ee] text-[#11130f]"
      style={{ colorScheme: "light" }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-8 w-px bg-[#d7d2c9] sm:left-16 lg:left-[4.35rem]"
      />
      <div
        aria-hidden="true"
        className="absolute left-[calc(2rem-4px)] top-[47.8vh] h-2 w-2 bg-[#11130f] sm:left-[calc(4rem-4px)] lg:left-[calc(4.35rem-4px)]"
      />

      <nav className="absolute right-6 top-7 z-20 sm:right-12 sm:top-12 lg:right-24 lg:top-14">
        <Link
          href="/blog"
          className={`${accessSmallText} text-[#171814]/55 transition-colors hover:text-[#171814] focus-visible:text-[#171814]`}
        >
          Blog
        </Link>
      </nav>

      <div className="relative z-10 min-h-screen-safe px-16 pb-14 pt-20 sm:px-[10.5rem] sm:pt-24 lg:px-0 lg:pt-0">
        <section
          className={`w-[min(34rem,calc(100vw-5rem))] ${
            mode ? "mt-[31vh]" : "mt-[47vh]"
          } lg:absolute lg:bottom-[16.5vh] lg:left-[10.75rem] lg:mt-0`}
        >
          <h1
            aria-label="PublisherIQ"
            className="font-sans text-[clamp(2.75rem,3.95vw,4.35rem)] font-normal leading-[0.92] tracking-[0.022em] text-[#11130f]"
          >
            <span aria-hidden="true">Publisher</span>
            <span aria-hidden="true" className="text-[#2e7654]">
              IQ
            </span>
          </h1>

          <div
            aria-hidden="true"
            className="mt-8 h-px w-[min(19rem,72vw)] bg-[#d7d2c9]"
          />

          <p className="mt-8 max-w-md text-[1.08rem] font-normal leading-7 tracking-[-0.01em] text-[#34342e]">
            For approved partners only.
          </p>

          <div className="mt-10 flex flex-col items-start gap-7 sm:flex-row sm:items-center sm:gap-9">
            <Link
              href={enterHref}
              aria-current={mode === "enter" ? "page" : undefined}
              className={`${accessSmallText} group inline-flex h-14 w-[13rem] items-center justify-between bg-[#090b09] px-11 text-[#f7f5ee] transition-colors hover:bg-[#171814] focus-visible:bg-[#171814]`}
            >
              <span>Enter</span>
              <span
                aria-hidden="true"
                className="text-[1rem] transition-transform group-hover:translate-x-1 group-focus-visible:translate-x-1"
              >
                {arrow}
              </span>
            </Link>

            <div
              aria-hidden="true"
              className="hidden h-9 w-px bg-[#cfc8bd] sm:block"
            />

            <Link
              href={requestHref}
              aria-current={mode === "request" ? "page" : undefined}
              className={`${accessSmallText} group inline-flex items-center gap-7 border-b border-[#171814]/45 pb-1.5 transition-colors hover:border-[#171814] hover:text-[#171814] focus-visible:border-[#171814] focus-visible:text-[#171814]`}
            >
              <span>Request access</span>
              <span
                aria-hidden="true"
                className="text-[1rem] transition-transform group-hover:translate-x-1 group-focus-visible:translate-x-1"
              >
                {arrow}
              </span>
            </Link>
          </div>
        </section>

        {mode ? (
          <aside
            aria-label={mode === "enter" ? "Enter" : "Request access"}
            className="mt-10 w-full max-w-[30rem] border-t border-[#d7d2c9] pb-12 pt-8 sm:max-w-[31rem] lg:absolute lg:bottom-[11.5vh] lg:right-[6vw] lg:mt-0 lg:max-h-[76vh] lg:w-[28rem] lg:overflow-y-auto lg:border-l lg:border-t-0 lg:pb-2 lg:pl-10 lg:pt-0 xl:right-[9vw]"
          >
            <div className="mb-8 flex items-center justify-between">
              <p className={`${accessSmallText} text-[#171814]/60`}>
                {mode === "enter" ? "Enter" : "Request access"}
              </p>
              <Link
                href={closeHref}
                className={`${accessSmallText} text-[#171814]/45 transition-colors hover:text-[#171814] focus-visible:text-[#171814]`}
              >
                Close
              </Link>
            </div>
            {children}
          </aside>
        ) : null}
      </div>
    </main>
  );
}

export const AccessInput = forwardRef<HTMLInputElement, AccessInputProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const inputId = id || label.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-3">
        <label htmlFor={inputId} className={accessLabelText}>
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={`h-12 w-full border-0 border-b border-[#cfc8bd] bg-transparent px-0 font-sans text-[1rem] leading-none tracking-[-0.01em] text-[#171814] outline-none transition-colors placeholder:text-[#171814]/25 hover:border-[#aaa196] focus:border-[#171814] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
          {...props}
        />
        {error ? (
          <p className="text-[0.82rem] leading-5 text-[#9a332c]">{error}</p>
        ) : null}
      </div>
    );
  },
);

AccessInput.displayName = "AccessInput";

export function AccessTextarea({
  label,
  error,
  className = "",
  id,
  ...props
}: AccessTextareaProps) {
  const textareaId = id || label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-3">
      <label htmlFor={textareaId} className={accessLabelText}>
        {label}
      </label>
      <textarea
        id={textareaId}
        className={`min-h-[5.5rem] w-full resize-none border-0 border-b border-[#cfc8bd] bg-transparent px-0 py-3 font-sans text-[1rem] leading-6 tracking-[-0.01em] text-[#171814] outline-none transition-colors placeholder:text-[#171814]/25 hover:border-[#aaa196] focus:border-[#171814] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
        {...props}
      />
      {error ? (
        <p className="text-[0.82rem] leading-5 text-[#9a332c]">{error}</p>
      ) : null}
    </div>
  );
}

export function AccessPrimaryButton({
  isLoading = false,
  disabled,
  children,
  className = "",
  ...props
}: AccessPrimaryButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={`${accessSmallText} group inline-flex h-14 w-full items-center justify-between bg-[#090b09] px-7 text-[#f7f5ee] transition-colors hover:bg-[#171814] focus-visible:bg-[#171814] disabled:pointer-events-none disabled:opacity-40 ${className}`}
      {...props}
    >
      <span>{children}</span>
      <span
        aria-hidden="true"
        className="text-[1rem] transition-transform group-hover:translate-x-1 group-focus-visible:translate-x-1"
      >
        {arrow}
      </span>
    </button>
  );
}

export function AccessTextButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`${accessSmallText} border-b border-[#171814]/35 pb-1.5 text-[#171814]/70 transition-colors hover:border-[#171814] hover:text-[#171814] focus-visible:border-[#171814] focus-visible:text-[#171814] disabled:pointer-events-none disabled:opacity-35 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function AccessSheetMessage({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-sans text-[1.35rem] font-normal leading-tight tracking-[-0.015em] text-[#171814]">
        {title}
      </h2>
      {children ? (
        <div className="text-[0.95rem] leading-6 tracking-[-0.01em] text-[#34342e]">
          {children}
        </div>
      ) : null}
    </div>
  );
}
