/* Components */
import { Providers } from "@/lib/providers";
import { Nav } from "./components/Nav";

/* Instruments */
import { Toaster } from "sonner";
import { Footer } from "./components/Footer";
import ThemeRegistry from "./styles/ThemeRegistry";
import "./styles/globals.css";
import styles from "./styles/layout.module.css";
import { GlobalPopups } from "./components/General/Popups/Popups";

export default function RootLayout(props: React.PropsWithChildren) {

  return (
    <Providers>
    <ThemeRegistry options={{ key: 'joy' }}>
      <html lang="en">
        <body>
        <Toaster closeButton richColors  />
        <GlobalPopups />
        <Nav />
            {props.children}
          <Footer />
        </body>
      </html>
    </ThemeRegistry>
    </Providers>
  );
}
