import type { JSX } from "react";
import ThemedLayout, { ThemedLayoutProps } from "@/src/ThemedLayout";

// Allowed to block: the root layout resolves the session before this renders,
// so nothing below it can prerender until that read moves behind Suspense.
export const instant = false;

/** Slot pages gate access (session or invite ?token=); do not requireAuth here. */
const Layout = async (props: ThemedLayoutProps): Promise<JSX.Element> => {
  return ThemedLayout(props);
};

export default Layout;
