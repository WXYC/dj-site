import { StoreProvider } from "@/src/StoreProvider";
import { type ReactNode } from "react";

import { getServerSideProps } from "@/lib/features/authentication/session";
import Appbar from "@/src/components/Theme/Appbar";
import "@/src/styles/globals.css";
import ThemeRegistry from "@/src/styles/ThemeRegistry";
import { Toaster } from "sonner";

export const runtime = "edge";

interface Props {
  children: ReactNode;
}

export default async function RootLayout({ children }: Props) {
  const serverSideProps = await getServerSideProps();

  return (
    <StoreProvider>
      <ThemeRegistry options={{ key: "joy" }}>
        <html
          lang="en"
          data-classic-view={serverSideProps.application.appSkin === "classic"}
          data-app-skin={serverSideProps.application.appSkin}
        >
          <body>
            <Toaster closeButton richColors />
            <div id="root">
              <main>
                {children}
                <Appbar />
              </main>
            </div>
          </body>
        </html>
      </ThemeRegistry>
    </StoreProvider>
  );
}
