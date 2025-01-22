"use client";

import { authenticationSlice } from "@/lib/features/authentication/slice";
import { VerifiedData } from "@/lib/features/authentication/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useState } from "react";

export default function RequiredBox({
  name,
  title,
  type,
}: {
  name: keyof VerifiedData;
  title: string;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
}): JSX.Element {
  const [value, setValue] = useState("");

  const validated = useAppSelector((state) =>
    authenticationSlice.selectors.getVerification(
      state,
      String(name) as keyof VerifiedData
    )
  );

  const dispatch = useAppDispatch();
  const reportValidation = (value: boolean) =>
    dispatch(
      authenticationSlice.actions.verify({
        key: String(name) as keyof VerifiedData,
        value,
      })
    );

  return (
    <>
      <td align="right" className="label">
        <b>{title}:</b>
      </td>
      <td>
        <input
          type={type || "text"}
          name={String(name)}
          value={value}
          onChange={(e) => {
            let value = e.target.value;
            setValue(value);
            reportValidation(value.length > 0);
          }}
        />
        {validated ? "✅" : "❌"}
      </td>
    </>
  );
}
