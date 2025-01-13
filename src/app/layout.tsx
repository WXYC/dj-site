import { Suspense, type ReactNode } from "react";
import { StoreProvider } from "./StoreProvider";

import ThemeRegistry from "./style/ThemeRegistry";
import { Toaster } from "sonner";
import Loader from "./components/Loader";
import ConfigureAmplifyClientSide from "./cognitoConfig";
import { Metadata } from "next";

import "./style/globals.css";

export const metadata: Metadata = {
  title: "WXYC",
  description: "Official DJ Management System for WXYC 89.3 FM",
};

interface Props {
  readonly children: ReactNode;
}

export default function RootLayout({ children }: Props) {
  return (
    <StoreProvider>
      <ThemeRegistry options={{ key: "joy" }}>
        <html lang="en">
          <body>
            <Toaster closeButton richColors />
            <div id="root">
              <Suspense fallback={<Loader />}>
              <ConfigureAmplifyClientSide />
                <main>{children}</main>
              </Suspense>
            </div>
          </body>
        </html>
      </ThemeRegistry>
    </StoreProvider>
  );
}
