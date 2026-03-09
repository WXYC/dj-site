import { ReactNode } from "react";
import Header from "@/src/components/experiences/classic/login/Layout/Header";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Login"),
};

interface LoginProps {
  readonly normal: ReactNode;
  readonly newuser: ReactNode;
}

export default async function Layout({ normal, newuser }: LoginProps) {
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
      {normal}
      <footer>
        <p>Copyright &copy; {new Date().getFullYear()} WXYC Chapel Hill</p>
      </footer>
    </div>
  );
}
