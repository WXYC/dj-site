"use client";

import { useEffect, useRef } from "react";

/**
 * Subscribe to document keydown exactly once; handler always reads latest ref.
 */
export function useDocumentKeydown(handler: (e: KeyboardEvent) => void) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => handlerRef.current(e);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);
}
