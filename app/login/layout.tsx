import { Suspense, type JSX } from "react";
import ThemedLayout, { ThemedLayoutProps } from "@/src/ThemedLayout";
import LoginBounceTelemetry from "./LoginBounceTelemetry";
import SessionEndedNotice from "./SessionEndedNotice";

// Allowed to block: the root layout resolves the session before this renders,
// so nothing below it can prerender until that read moves behind Suspense.
export const instant = false;

const Layout = async (props: ThemedLayoutProps): Promise<JSX.Element> => {
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
