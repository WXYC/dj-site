"use client";
import { useAppSelector } from "@/lib/hooks";
import { getClassic } from "@/lib/slices/application/selectors";
import ClassicDashboard from "./classic";
import ModernDashboard from "./modern";

export default function Dashboard({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const classic = useAppSelector(getClassic);

  return classic ? (
    <ClassicDashboard>{children}</ClassicDashboard>
  ) : (
    <ModernDashboard>{children}</ModernDashboard>
  );
}
