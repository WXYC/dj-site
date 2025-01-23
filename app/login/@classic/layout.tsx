import { AuthenticationStage } from "@/lib/features/authentication/types";
import { createServerSideProps } from "@/lib/features/session";
import { ReactNode } from "react";
import Header from "./components/Layout/Header";

interface LoginProps {
  readonly normal: ReactNode;
  readonly reset: ReactNode;
}

export default async function Layout({ normal, reset }: LoginProps) {
  const serverSideProps = await createServerSideProps();

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        height: "100%"
      }}
    >
      <Header />
        {serverSideProps.authentication?.stage ==
        AuthenticationStage.NewPassword
          ? reset
          : normal}
      <footer>
        <p>Copyright &copy; {new Date().getFullYear()} WXYC Chapel Hill</p>
      </footer>
    </div>
  );
}
