import AutoDJBanner from "@/src/components/experiences/modern/autoDJ/AutoDJBanner";
import FlowsheetSkeletonLoader from "@/src/components/experiences/modern/flowsheet/FlowsheetSkeletonLoader";
import GoLive from "@/src/components/experiences/modern/flowsheet/GoLive";
import InfiniteScroller from "@/src/components/experiences/modern/flowsheet/InfiniteScroller";
import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import SSEConnectionIndicator from "@/src/components/shared/SSEConnectionIndicator";
import SSESubscription from "@/src/components/shared/SSESubscription";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import { Suspense } from "react";
import FlowsheetSearch from "./flowsheet-search";

export const metadata: Metadata = {
  title: getPageTitle("Flowsheet"),
};

export type FlowsheetPageProps = {
  children: React.ReactNode;
  queue: React.ReactNode;
  entries: React.ReactNode;
};

// The search bar lives in the layout (not the page) so the nested album/[id]
// segment can occupy `children` while the full flowsheet stays visible.
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
        <SSEConnectionIndicator />
        <GoLive />
      </PageHeader>
      <>
        <FlowsheetSearch />
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
