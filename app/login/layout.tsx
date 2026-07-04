import { Suspense, type JSX } from "react";
import ThemedLayout, { LoginLayoutProps } from "@/src/ThemedLayout";
import LoginBounceTelemetry from "./LoginBounceTelemetry";
import SessionEndedNotice from "./SessionEndedNotice";

const Layout = async (props: LoginLayoutProps): Promise<JSX.Element> => {
  const themed = await ThemedLayout(props);
  return (
    <>
      {/* Server-bounce telemetry + the DJ-facing session-ended notice. Both read
          useSearchParams, which requires a Suspense boundary; each renders
          nothing so the fallback is null. */}
      <Suspense fallback={null}>
        <LoginBounceTelemetry />
        <SessionEndedNotice />
      </Suspense>
      {themed}
    </>
  );
};

export default Layout;
