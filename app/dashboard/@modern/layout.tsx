import type { JSX, ReactNode } from "react";
import Main from "@/src/components/experiences/modern/Main";
import Rightbar from "@/src/components/experiences/modern/Rightbar/Rightbar";
import MobileHeader from "@/src/components/experiences/modern/Header/MobileHeader";
import DesktopHeader from "@/src/components/experiences/modern/Header/DesktopHeader";
import Leftbar from "@/src/components/experiences/modern/Leftbar/Leftbar";
import AutoDJGreyscale from "@/src/components/experiences/modern/autoDJ/AutoDJGreyscale";

export default function ModernDashboard({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <AutoDJGreyscale>
      <MobileHeader />
      <Leftbar />
      <Main>
        <DesktopHeader />
        {children}
      </Main>
      <Rightbar />
    </AutoDJGreyscale>
  );
}
