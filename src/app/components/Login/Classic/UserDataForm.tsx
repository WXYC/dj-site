"use client";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { authenticationSlice } from "@/lib/slices";
import {
  getCredentials,
  getIsPending,
  getIsValid,
  getValidation,
} from "@/lib/slices/authentication/selectors";

export default function UserDataForm(): JSX.Element {
  const handlePasswordUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  const dispatch = useAppDispatch();

  const isValid = useAppSelector(getIsValid);
  const authenticating = useAppSelector(getIsPending);

  const credentials = useAppSelector(getCredentials);
  const validation = useAppSelector(getValidation);

  return (
    <form name="userpw" onSubmit={handlePasswordUpdate}>
      <div>
        <table cellPadding="10">
          <tbody>
            <tr>
              <td align="center" valign="top">
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
                <span className="title">Please update your information:</span>
                <br />
                <table cellPadding="10">
                  <tr>
                    <td align="right" className="label">
                      <b>Real Name:</b>
                    </td>
                    <td>
                      <input
                        type="text"
                        name="name"
                        value={credentials["realname"]}
                        onChange={(e) => {
                          dispatch(
                            authenticationSlice.actions.updateCredentials({
                              ...credentials,
                              realname: e.target.value,
                            })
                          );
                          dispatch(
                            authenticationSlice.actions.updateValidation({
                              field: "realname",
                              approved: e.target.value.length > 0,
                            })
                          );
                        }}
                      />
                      {validation["realname"] ? "✅" : "❌"}
                    </td>
                  </tr>
                  <tr>
                    <td align="right" className="label">
                      <b>DJ Name:</b>
                    </td>
                    <td>
                      <input
                        type="text"
                        name="djName"
                        value={credentials["djname"]}
                        onChange={(e) => {
                          dispatch(
                            authenticationSlice.actions.updateCredentials({
                              ...credentials,
                              djname: e.target.value,
                            })
                          );
                          dispatch(
                            authenticationSlice.actions.updateValidation({
                              field: "djname",
                              approved: e.target.value.length > 0,
                            })
                          );
                        }}
                      />
                      {validation["djname"] ? "✅" : "❌"}
                    </td>
                  </tr>
                  <tr>
                    <td align="right" className="label">
                      <b>New Password*:</b>
                    </td>
                    <td>
                      <input
                        type="password"
                        name="password"
                        value={credentials["password"]}
                        onChange={(e) => {
                          var value = e.target.value;
                          dispatch(
                            authenticationSlice.actions.updateCredentials({
                              ...credentials,
                              password: value,
                            })
                          );
                          dispatch(
                            authenticationSlice.actions.updateValidation({
                              field: "password",
                              approved:
                                /[A-Z]/.test(value) &&
                                /[a-z]/.test(value) &&
                                /[0-9]/.test(value) &&
                                value.length >= 8,
                            })
                          );
                        }}
                      />
                      {validation["password"] ? "✅" : "❌"}
                    </td>
                  </tr>
                  <tr>
                    <td align="right" className="label">
                      <b>Confirm Password:</b>
                    </td>
                    <td>
                      <input
                        type="password"
                        name="confirmPassword"
                        onChange={(e) => {
                          dispatch(
                            authenticationSlice.actions.updateValidation({
                              field: "compareTo",
                              approved: e.target.value == credentials.password,
                            })
                          );
                        }}
                      />
                      {validation["compareTo"] ? "✅" : "❌"}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} align="center">
                      <input
                        type="submit"
                        value="Submit"
                        disabled={authenticating || !isValid}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td></td>
                    <td>
                      <label htmlFor="password">
                        *Needs one capital letter, one lowercase letter, and one
                        number
                      </label>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </form>
  );
}
