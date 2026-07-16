import type { JSX } from "react";
import { requireAuth } from "@/lib/features/authentication/server-utils";
import ThemedLayout, { ThemedLayoutProps } from "@/src/ThemedLayout";

const Layout = async (props: ThemedLayoutProps): Promise<JSX.Element> => {
  await requireAuth();
  return ThemedLayout(props);
};

export default Layout;
