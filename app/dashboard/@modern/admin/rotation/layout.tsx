import type { JSX } from "react";
import RotationTabs from "@/src/components/experiences/modern/admin/rotation/RotationTabs";

// Authority is enforced per page, not here: this layout is a deep-linkable
// tab strip only, matching the "page authority is server-side" rule in
// docs/architecture.md.
export default function RotationAdminLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <>
      <RotationTabs />
      {children}
    </>
  );
}
