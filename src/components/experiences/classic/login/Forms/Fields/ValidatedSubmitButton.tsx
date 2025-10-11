"use client";

export const ValidatedSubmitButton = ({
  authenticating,
  valid,
}: {
  authenticating: boolean;
  valid: boolean;
}) => {
  return (
    <button type="submit" disabled={authenticating || !valid} style = {{ width: "180px"}}>
      {authenticating ? "Loading" : "Submit"}
    </button>
  );
};
