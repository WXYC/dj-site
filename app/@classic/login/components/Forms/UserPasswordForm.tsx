"use client";

import { useLogin } from "@/app/hooks/authenticationHooks";
import Main from "../Layout/Main";
import RequiredBox from "./Fields/RequiredBox";
import { ValidatedSubmitButton } from "./Fields/ValidatedSubmitButton";

export default function UserPasswordForm() {
  const { handleLogin, verified, authenticating } = useLogin();

  return (
    <form
      onSubmit={handleLogin}
      style={{
        height: "90%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <Main title="Please log in to WXYC Library:">
        <table cellPadding="10">
          <tbody>
            <tr>
              <RequiredBox
                name="username"
                title="User Login"
                placeholder="Username"
                type="text"
              />
            </tr>
            <tr>
              <RequiredBox name="password" title="Password" type="password" />
            </tr>
            <tr>
              <td></td>
              <td>
                <ValidatedSubmitButton
                  authenticating={authenticating}
                  valid={verified}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </Main>
    </form>
  );
}
