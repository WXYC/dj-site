"use client";
import type { PublicAppStore } from "@/lib/store-public";
import { makePublicStore } from "@/lib/store-public";
import { setupListeners } from "@reduxjs/toolkit/query";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Provider } from "react-redux";

interface Props {
  readonly children: ReactNode;
}

// Wraps every route with the reduced public store. The authenticated dashboard
// layout nests the full store inside this one, so its subtree resolves to the
// superset while the shared shell (theme controls) keeps reading the public
// store here.
export const PublicStoreProvider = ({ children }: Props) => {
  const storeRef = useRef<PublicAppStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = makePublicStore();
  }

  useEffect(() => {
    if (storeRef.current != null) {
      const unsubscribe = setupListeners(storeRef.current.dispatch);
      return unsubscribe;
    }
  }, []);

  return <Provider store={storeRef.current}>{children}</Provider>;
};
