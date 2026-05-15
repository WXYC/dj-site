"use client";

import { useLogin } from "@/src/hooks/authenticationHooks";
import Main from "../Layout/Main";
import RequiredBox from "./Fields/RequiredBox";
import { ValidatedSubmitButton } from "./Fields/ValidatedSubmitButton";

export default function UserPasswordForm() {
  const { handleLogin, verified, authenticating } = useLogin();

  return (
    <form
      onSubmit={handleLogin}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <Main title="Please log in to WXYC Library:">
        <tr>
          <RequiredBox
            name="username"
            title="User Login"
            placeholder="Username"
            type="text"
            disabled={authenticating}
          />
        </tr>
        <tr>
          <RequiredBox
            name="password"
            title="Password"
            type="password"
            disabled={authenticating}
          />
        </tr>
        <tr className="signon-submit-row">
          <td colSpan={2}>
            <ValidatedSubmitButton
              authenticating={authenticating}
              valid={verified}
            />
          </td>
        </tr>
      </Main>
    </form>
  );
}
