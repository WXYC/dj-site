import { getServerSideProps } from "@/lib/features/authentication/session";
import { isIncomplete } from "@/lib/features/authentication/types";
import { ReactNode } from "react";
import Header from "./components/Layout/Header";

interface LoginProps {
  readonly normal: ReactNode;
  readonly newuser: ReactNode;
}

export default async function Layout({ normal, newuser }: LoginProps) {
  const serverSideProps = await getServerSideProps();

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
      {isIncomplete(serverSideProps.authentication) ? newuser : normal}
      <footer>
        <p>Copyright &copy; {new Date().getFullYear()} WXYC Chapel Hill</p>
      </footer>
    </div>
  );
}
