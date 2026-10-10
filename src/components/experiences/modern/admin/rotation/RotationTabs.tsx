"use client";

import type { JSX } from "react";
import PageTabs from "@/src/components/experiences/modern/PageTabs";

const TABS = [
  { path: "/dashboard/admin/rotation/new", label: "Add to rotation" },
  { path: "/dashboard/admin/rotation", label: "Rotation list" },
  { path: "/dashboard/admin/rotation/cards", label: "Cards" },
] as const;

export default function RotationTabs(): JSX.Element {
  return <PageTabs tabs={TABS} />;
}
