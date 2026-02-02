import { requireAuth } from "@/lib/features/authentication/server-utils";
import ThemedLayout, { LoginLayoutProps } from "@/src/ThemedLayout";

const Layout = async (props: LoginLayoutProps): Promise<JSX.Element> => {
  await requireAuth();
  return ThemedLayout(props);
};

export default Layout;
