import FlowsheetSkeletonLoader from "@/src/components/modern/flowsheet/FlowsheetSkeletonLoader";
import GoLive from "@/src/components/modern/flowsheet/GoLive";
import FlowsheetSearchbar from "@/src/components/modern/flowsheet/Search/FlowsheetSearchbar";
import PageHeader from "@/src/components/modern/Header/PageHeader.";
import { Divider, Sheet } from "@mui/joy";
import { Suspense } from "react";

export type FlowsheetPageProps = {
  children: React.ReactNode;
  queue: React.ReactNode;
  entries: React.ReactNode;
};

export default function FlowsheetPage({ children, queue, entries }: FlowsheetPageProps) {
  return (
    <>
      <PageHeader title="Flowsheet">
        <GoLive />
      </PageHeader>
      <>
        {children}
        <Sheet
          sx={{
            maxHeight: "calc(100vh - 200px)",
            overflowY: "auto",
            background: "transparent",
            mt: 2,
            overflowX: "visible",
          }}
        >
          <Suspense fallback={<FlowsheetSkeletonLoader count={2} />}>
          {queue}
          </Suspense>
          <Divider sx={{ my: 1 }} />
          <Suspense fallback={<FlowsheetSkeletonLoader count={8} />}>
            {entries}
          </Suspense>
        </Sheet>
      </>
    </>
  );
}
