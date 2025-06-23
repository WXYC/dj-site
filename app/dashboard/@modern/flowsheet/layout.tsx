import FlowsheetSkeletonLoader from "@/src/components/modern/flowsheet/FlowsheetSkeletonLoader";
import GoLive from "@/src/components/modern/flowsheet/GoLive";
import InfiniteScroller from "@/src/components/modern/flowsheet/InfiniteScroller";
import PageHeader from "@/src/components/modern/Header/PageHeader";
import { Divider } from "@mui/joy";
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
      <PageHeader title="Flowsheet">
        <GoLive />
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
