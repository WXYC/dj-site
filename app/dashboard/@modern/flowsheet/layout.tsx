import AutoDJBanner from "@/src/components/experiences/modern/autoDJ/AutoDJBanner";
import FlowsheetSkeletonLoader from "@/src/components/experiences/modern/flowsheet/FlowsheetSkeletonLoader";
import GoLive from "@/src/components/experiences/modern/flowsheet/GoLive";
import InfiniteScroller from "@/src/components/experiences/modern/flowsheet/InfiniteScroller";
import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import SSEConnectionIndicator from "@/src/components/shared/SSEConnectionIndicator";
import SSESubscription from "@/src/components/shared/SSESubscription";
import { Box } from "@mui/joy";
import { Suspense } from "react";

export type FlowsheetPageProps = {
  children: React.ReactNode;
  queue: React.ReactNode;
  entries: React.ReactNode;
};

export default function FlowsheetPage({
  children,
  queue,
  entries,
}: FlowsheetPageProps) {
  return (
    <>
      <SSESubscription surface="dashboard" />
      <AutoDJBanner />
      <PageHeader title="Flowsheet">
        <Box
          component="div"
          sx={{ display: "flex", alignItems: "center", gap: 1 }}
        >
          <SSEConnectionIndicator />
          <GoLive />
        </Box>
      </PageHeader>
      <>
        {children}
        <InfiniteScroller>
          <Suspense fallback={<FlowsheetSkeletonLoader count={2} />}>
            {queue}
          </Suspense>
          <Suspense fallback={<FlowsheetSkeletonLoader count={8} />}>
            {entries}
          </Suspense>
        </InfiniteScroller>
      </>
    </>
  );
}
