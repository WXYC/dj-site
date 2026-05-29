import { ReactNode } from "react";
import Header from "@/src/components/experiences/classic/login/Layout/Header";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import ClassicLoginSlotSwitcher from "./ClassicLoginSlotSwitcher";

export const metadata: Metadata = {
  title: getPageTitle("Login"),
};

interface LoginProps {
  readonly normal: ReactNode;
  readonly newuser: ReactNode;
  readonly reset: ReactNode;
}

export default async function Layout({ normal, newuser, reset }: LoginProps) {
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <Header />
      <ClassicLoginSlotSwitcher normal={normal} reset={reset} />
      <footer>
        <p>Copyright &copy; {new Date().getFullYear()} WXYC Chapel Hill</p>
      </footer>
    </div>
  );
}
