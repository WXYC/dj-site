import ThemedLayout, { DashboardLayoutProps } from "@/src/ThemedLayout";

const Layout = async (props: DashboardLayoutProps): Promise<JSX.Element> =>
  ThemedLayout(props);

export default Layout;
