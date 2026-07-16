"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initTelemetry, safeCapturePageview } from "@/lib/posthog";
import { installCspViolationReporter } from "@/lib/csp-violation-reporter";
import type { ReactNode } from "react";

function TelemetryPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    let url = window.origin + pathname;
    if (searchParams.toString()) {
      url += "?" + searchParams.toString();
    }
    safeCapturePageview(url);
  }, [pathname, searchParams]);

  return null;
}

interface Props {
  readonly children: ReactNode;
}

export function TelemetryProvider({ children }: Props) {
  useEffect(() => {
    initTelemetry();
    // Report-Only CSP violations (#631) fire securitypolicyviolation events
    // client-side; forward them to PostHog so the rollout gathers signal.
    installCspViolationReporter();
  }, []);

  return (
    <>
      {/* useSearchParams must sit under a Suspense boundary so it never forces
          ancestor routes into dynamic rendering. */}
      <Suspense fallback={null}>
        <TelemetryPageView />
      </Suspense>
      {children}
    </>
  );
}
