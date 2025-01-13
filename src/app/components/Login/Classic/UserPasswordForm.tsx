"use client";
import { handleSignIn } from "@/lib/cognitoActions";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { authenticationSlice } from "@/lib/slices";
import {
  getCredentials,
  getIsPending,
  getIsValid,
  getValidation,
} from "@/lib/slices/authentication/selectors";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { useFormState } from "react-dom";
import { toast } from "sonner";

export default function UserPasswordForm(): JSX.Element {
  const dispatch = useAppDispatch();

  const [response, dispatchSignIn] = useFormState(handleSignIn, undefined);

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    dispatch(authenticationSlice.actions.setPending(true));

    const data = new FormData(e.currentTarget);

    dispatchSignIn(data);
  };

  useEffect(() => {
    if (!response?.passwordChallenge && response?.user) {
      dispatch(authenticationSlice.actions.setPending(false));
      toast.error(response.user);
    }
    dispatch(authenticationSlice.actions.setResponse(response));
    if (response && response.passwordChallenge) {
      dispatch(authenticationSlice.actions.setPending(false));
    }
  }, [response]);

  const isValid = useAppSelector(getIsValid);
  const authenticating = useAppSelector(getIsPending);

  const credentials = useAppSelector(getCredentials);
  const validation = useAppSelector(getValidation);

  return (
    <form name="userpw" onSubmit={handleLogin}>
      <div>
        <table cellPadding="10">
          <tbody>
            <tr>
              <td
                align="center"
                valign="top"
                style={{ display: "flex", justifyContent: "center" }}
              >
                <img
                  src={`/img/wxyc-logo-classic.gif`}
                  alt="WXYC logo"
                  style={{ border: 0 }}
                />
              </td>
            </tr>
          </tbody>
        </table>
        <table cellPadding="10" style={{ height: "90%" }}>
          <tbody>
            <tr>
              <td align="center">
                <span className="title">
                  Please log in to WXYC Library and Flowsheet:
                </span>
                <br />
                <table cellPadding="10">
                  <tbody>
                    <tr>
                      <td align="right" className="label">
                        <b>User Login:</b>
                      </td>
                      <td>
                        <input
                          type="text"
                          name="username"
                          value={credentials["username"]}
                          onChange={(e) => {
                            dispatch(
                              authenticationSlice.actions.updateCredentials({
                                ...credentials,
                                username: e.target.value,
                              })
                            );
                            dispatch(
                              authenticationSlice.actions.updateValidation({
                                field: "username",
                                approved: e.target.value.length > 0,
                              })
                            );
                          }}
                        />
                        {credentials["username"]}
                        {validation["username"] ? "✅" : "❌"}
                      </td>
                    </tr>
                    <tr>
                      <td align="right" className="label">
                        <b>Password:</b>
                      </td>
                      <td>
                        <input
                          type="password"
                          name="password"
                          value={credentials["password"]}
                          onChange={(e) => {
                            dispatch(
                              authenticationSlice.actions.updateCredentials({
                                ...credentials,
                                password: e.target.value,
                              })
                            );
                            dispatch(
                              authenticationSlice.actions.updateValidation({
                                field: "password",
                                approved: e.target.value.length > 0,
                              })
                            );
                          }}
                        />
                        {credentials["password"]}
                        {validation["password"] ? "✅" : "❌"}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={2} align="center">
                        <input
                          disabled={!isValid || authenticating}
                          type="submit"
                          value="Submit User ID and Password"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={2} align="center">
                        <input type="reset" value="Reset to default values" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </form>
  );
}
