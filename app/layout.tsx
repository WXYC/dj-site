import { type ReactNode } from "react";
import { StoreProvider } from "@/src/StoreProvider";

import "@/src/styles/globals.css";
import { createServerSideProps } from "@/lib/features/session";
import { Toaster } from "sonner";
import Appbar from "@/src/components/shared/Theme/Appbar";
import ThemeRegistry from "@/src/styles/ThemeRegistry";


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
