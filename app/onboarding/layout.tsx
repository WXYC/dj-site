import type { JSX } from "react";
import ThemedLayout, { LoginLayoutProps } from "@/src/ThemedLayout";

/** Slot pages gate access (session or invite ?token=); do not requireAuth here. */
const Layout = async (props: LoginLayoutProps): Promise<JSX.Element> => {
  return ThemedLayout(props);
};

export default Layout;
