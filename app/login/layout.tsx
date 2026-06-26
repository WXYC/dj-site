import { Suspense, type JSX } from "react";
import ThemedLayout, { LoginLayoutProps } from "@/src/ThemedLayout";
import LoginBounceTelemetry from "./LoginBounceTelemetry";

const Layout = async (props: LoginLayoutProps): Promise<JSX.Element> => {
  const themed = await ThemedLayout(props);
  return (
    <>
      {/* Server-bounce telemetry. useSearchParams requires a Suspense
          boundary; the component renders nothing so the fallback is null. */}
      <Suspense fallback={null}>
        <LoginBounceTelemetry />
      </Suspense>
      {themed}
    </>
  );
};

export default Layout;
