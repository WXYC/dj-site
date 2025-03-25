"use client";

import { FlowsheetQuery } from "@/lib/features/flowsheet/types";
import { useFlowsheetSearch } from "@/src/hooks/flowsheetHooks";
import { toTitleCase } from "@/src/utilities/stringutilities";
import { InputHTMLAttributes, useEffect } from "react";

export default function FlowsheetSearchInput({
  name,
  ...props
}: Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "placeholder" | "value" | "onChange" | "onClick"
> & { name: keyof Omit<FlowsheetQuery, "request"> }) {
  const { searchQuery, setSearchProperty } = useFlowsheetSearch();

  useEffect(() => {
    console.log(toTitleCase(name));
  }, [name]);

  return (
    <input
      name={name}
      type="text"
      placeholder={toTitleCase(name)}
      value={searchQuery[name]}
      onChange={(e) => setSearchProperty(name, e.target.value)}
      onClick={(e) => e.stopPropagation()}
      {...props}
    />
  );
}
