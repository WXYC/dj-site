import { Suspense, type ReactNode } from "react";
import { StoreProvider } from "./StoreProvider";

import { LoadingPage } from "@/app/components/LoadingPage";
import "@/app/styles/globals.css";
import { createServerSideProps } from "@/lib/features/session";
import { Toaster } from "sonner";
import Appbar from "./components/Theme/Appbar";
import ThemeRegistry from "./styles/ThemeRegistry";

interface Props {
  readonly classic: ReactNode;
  readonly modern: ReactNode;
}

export default async function RootLayout({ classic, modern }: Props) {
  const serverSideProps = await createServerSideProps();

  return (
    <StoreProvider>
      <ThemeRegistry options={{ key: "joy" }}>
        <html lang="en" data-classic-view={serverSideProps.application.classic}>
          <body>
            <Toaster closeButton richColors />
            <div id="root">
              <main>
                <Suspense fallback={<LoadingPage />}>
                  {serverSideProps.application.classic ? classic : modern}
                </Suspense>
                <Appbar />
              </main>
            </div>
          </body>
        </html>
      </ThemeRegistry>
    </StoreProvider>
  );
}
