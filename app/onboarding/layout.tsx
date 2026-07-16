import type { JSX } from "react";
import ThemedLayout, { ThemedLayoutProps } from "@/src/ThemedLayout";

/** Slot pages gate access (session or invite ?token=); do not requireAuth here. */
const Layout = async (props: ThemedLayoutProps): Promise<JSX.Element> => {
  return ThemedLayout(props);
};

export default Layout;
