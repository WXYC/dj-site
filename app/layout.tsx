/* Components */
import { Providers } from "@/lib/providers";

/* Instruments */
import { Toaster } from "sonner";
import { GlobalPopups } from "./components/General/Popups/Popups";
import ThemeRegistry from "./styles/ThemeRegistry";
import "./styles/classic.css";
import "./styles/globals.css";

export default function RootLayout(props: React.PropsWithChildren) {

  return (
    <Providers>
      <ThemeRegistry options={{ key: 'joy' }}>
        <html lang="en">
          <body>
          <Toaster closeButton richColors  />
          <GlobalPopups />
          <div id="root">
            <main>
                {props.children}
            </main>
          </div>
          </body>
        </html>
      </ThemeRegistry>
    </Providers>
  );
}


