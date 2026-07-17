import type { JSX } from "react";
import { requireAuth } from "@/lib/features/authentication/server-utils";
import ThemedLayout, { ThemedLayoutProps } from "@/src/ThemedLayout";
import { StoreProvider } from "@/src/StoreProvider";

// The full slice/API store is scoped to the authenticated dashboard, nested
// inside the app-wide public store. Dashboard-only feature graphs (admin
// roster, catalog, rotation, autoDJ, bin, metadata, LML) resolve here and stay
// out of the public routes' client bundles.
const Layout = async (props: ThemedLayoutProps): Promise<JSX.Element> => {
  await requireAuth();
  const themed = await ThemedLayout(props);
  return <StoreProvider>{themed}</StoreProvider>;
};

export default Layout;
