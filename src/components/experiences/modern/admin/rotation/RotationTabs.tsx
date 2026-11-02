"use client";

import type { JSX } from "react";
import PageTabs from "@/src/components/experiences/modern/PageTabs";

const TABS = [
  { path: "/dashboard/admin/rotation", label: "Shelf" },
  { path: "/dashboard/admin/rotation/new", label: "Add to rotation" },
] as const;

export default function RotationTabs(): JSX.Element {
  return <PageTabs tabs={TABS} />;
}
