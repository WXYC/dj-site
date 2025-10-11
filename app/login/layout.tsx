import ThemedLayout, { LoginLayoutProps } from "@/src/ThemedLayout";

const Layout = async (props: LoginLayoutProps): Promise<JSX.Element> =>
  ThemedLayout(props);

export default Layout;
