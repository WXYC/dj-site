import { requireAuth } from "@/lib/features/authentication/server-utils";
import ThemedLayout, { DashboardLayoutProps } from "@/src/ThemedLayout";
import { ReactNode } from "react";

export type DashboardRootLayoutProps = DashboardLayoutProps & {
  information?: ReactNode;
};

const Layout = async ({
  modern,
  classic,
  information,
}: DashboardRootLayoutProps): Promise<JSX.Element> => {
  await requireAuth();
  return ThemedLayout({ modern, classic, information });
};

export default Layout;
