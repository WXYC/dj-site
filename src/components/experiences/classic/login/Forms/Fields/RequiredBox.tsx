"use client";

import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { VerifiedData } from "@/lib/features/authentication/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useEffect, useRef, useState } from "react";

export default function RequiredBox({
  name,
  title,
  type,
  disabled,
}: {
  name: keyof VerifiedData;
  title: string;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  disabled?: boolean;
}): JSX.Element {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    const isValid = value.length > 0;
    if (validated !== isValid) {
      reportValidation(isValid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reportValidation is intentionally excluded to avoid infinite re-renders
  }, [value, validated]);

  useEffect(() => {
    const syncFromDom = () => {
      const domValue = inputRef.current?.value ?? value;
      if (domValue !== value) {
        setValue(domValue);
      }
      const isValid = domValue.length > 0;
      if (validated !== isValid) {
        reportValidation(isValid);
      }
    };

    const timers = [setTimeout(syncFromDom, 0), setTimeout(syncFromDom, 300)];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once on mount to detect browser autofill
  }, []);

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
          disabled={disabled}
          ref={inputRef}
          onChange={(e) => {
            const value = e.target.value;
            setValue(value);
            reportValidation(value.length > 0);
          }}
        />
        {validated ? "✅" : "❌"}
      </td>
    </>
  );
}
