"use client";
import { useAppSelector } from "@/lib/hooks";
import { getClassic } from "@/lib/slices/application/selectors";
import ClassicLoginPage from "./classic";
import ModernLoginPage from "./modern";

export default function LoginPage(): JSX.Element {
  const classic = useAppSelector(getClassic);

  if (classic) {
    return <ClassicLoginPage />;
  } else {
    return <ModernLoginPage />;
  }
}
