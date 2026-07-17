"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

// Kept free of any Redux/feature imports: the always-mounted appbar reads this
// on every route, so pulling a slice graph in here would land it in every
// client bundle, including the public routes this scoping keeps lean.
const PUBLIC_ROUTES = ["/live", "/login"];

export const usePublicRoutes = (): boolean => {
  const pathname = usePathname();

  return useMemo(() => {
    return PUBLIC_ROUTES.includes(pathname) || pathname.length <= 1;
  }, [pathname]);
};
