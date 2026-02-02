import { requireAuth } from "@/lib/features/authentication/server-utils";
import ThemedLayout, { DashboardLayoutProps } from "@/src/ThemedLayout";

const Layout = async (props: DashboardLayoutProps): Promise<JSX.Element> => {
  // Require authentication for all dashboard routes
  await requireAuth();
  return ThemedLayout(props);
};

export default Layout;
