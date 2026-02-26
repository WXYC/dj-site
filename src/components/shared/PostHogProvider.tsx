"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { initPostHog, posthog } from "@/lib/posthog";
import type { ReactNode } from "react";

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname;
      if (searchParams.toString()) {
        url += "?" + searchParams.toString();
      }
      posthog.capture("$pageview", { $current_url: url });
    }
  }, [pathname, searchParams]);

  return null;
}

interface Props {
  readonly children: ReactNode;
}

export function PostHogProvider({ children }: Props) {
  useEffect(() => {
    initPostHog();
  }, []);

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
}
