"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { forwardRef } from "react";

/**
 * Next.js App Router Link with ref forwarding for Joy UI `component={…}`.
 * Avoids useRootElementName hydration warnings from using `next/link` directly.
 */
const JoyNextLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof NextLink>>(
  function JoyNextLink(props, ref) {
    return <NextLink ref={ref} {...props} />;
  },
);

JoyNextLink.displayName = "JoyNextLink";

export default JoyNextLink;
