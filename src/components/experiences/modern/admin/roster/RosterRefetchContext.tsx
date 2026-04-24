"use client";

import { createContext, useContext } from "react";

const RosterRefetchContext = createContext<(() => Promise<void>) | null>(null);

export function RosterRefetchProvider({
  refetch,
  children,
}: {
  refetch: () => Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <RosterRefetchContext.Provider value={refetch}>
      {children}
    </RosterRefetchContext.Provider>
  );
}

export function useRosterRefetch(): (() => Promise<void>) | null {
  return useContext(RosterRefetchContext);
}
