import { type ReactNode } from "react";
import { StoreProvider } from "@/src/StoreProvider";

import "@/src/styles/globals.css";
import { createServerSideProps } from "@/lib/features/session";
import { Toaster } from "sonner";
import Appbar from "@/src/components/shared/Theme/Appbar";
import ThemeRegistry from "@/src/styles/ThemeRegistry";
import PageTitleUpdater from "@/src/components/shared/PageTitleUpdater";
import { Metadata } from "next";

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "android-chrome-192x192",
        url: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        rel: "android-chrome-512x512",
        url: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  },
};

interface Props {
  children: ReactNode;
}

export default async function RootLayout({ children }: Props) {
  const serverSideProps = await createServerSideProps();

  return (
    <StoreProvider>
      <ThemeRegistry options={{ key: "joy" }}>
        <html lang="en" data-experience={serverSideProps.application.experience}>
          <body>
            <Toaster closeButton richColors />
            <PageTitleUpdater />
            <div id="root" style={{ height: "100%", overflow: "hidden" }}>
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
