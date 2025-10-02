import { ReactNode } from "react";
import Header from "./components/Layout/Header";

interface LoginProps {
  readonly normal: ReactNode;
}

export default async function Layout({ normal }: LoginProps) {
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
