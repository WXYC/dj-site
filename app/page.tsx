/* Components */
import { redirect } from "next/navigation";

export default function IndexPage() {
  redirect("/dashboard/flowsheet");
}

export const metadata = {
  title: "WXYC DJ Site",
};
