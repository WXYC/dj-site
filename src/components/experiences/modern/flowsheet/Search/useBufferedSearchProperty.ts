"use client";

import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { FlowsheetSearchProperty } from "@/lib/features/flowsheet/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";
import { useCallback, useEffect, useRef, useState } from "react";

export function useBufferedSearchProperty(
  name: FlowsheetSearchProperty,
  delay = 200
) {
  const dispatch = useAppDispatch();
  const storeValue = useAppSelector(
    (state) => flowsheetSlice.selectors.getSearchQuery(state)[name] as string
  );

  const [local, setLocal] = useState(storeValue);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!dirtyRef.current) setLocal(storeValue);
  }, [storeValue]);

  const debounced = useDebouncedValue(local, delay);
  useEffect(() => {
    if (dirtyRef.current) {
      dispatch(
        flowsheetSlice.actions.setSearchProperty({ name, value: debounced })
      );
      dirtyRef.current = false;
    }
  }, [debounced, dispatch, name]);

  const onChange = useCallback((value: string) => {
    dirtyRef.current = true;
    setLocal(value);
  }, []);

  const flush = useCallback(() => {
    if (dirtyRef.current) {
      dispatch(
        flowsheetSlice.actions.setSearchProperty({ name, value: local })
      );
      dirtyRef.current = false;
    }
  }, [dispatch, name, local]);

  return { value: local, onChange, flush };
}
