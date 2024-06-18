"use client";

import { login, needsNewPassword, useDispatch, useSelector } from "@/lib/redux";
import AuthenticationGuard from "../components/Authentication/AuthenticationGuard";
import LeaveClassic from "../components/Classic/LeaveClassic";

export default function ClassicLogin() {
  const dispatch = useDispatch();

  const resetPasswordRequired = useSelector(needsNewPassword);
  const handlePasswordUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const username = form.username.value;
    const password = form.password.value;

    if (username && password) {
      dispatch(login({ username, password }));
    }
  };

  return resetPasswordRequired ? (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <AuthenticationGuard redirectTo="/login" savePath />
      <LeaveClassic />
      <form name="userpw" onSubmit={handlePasswordUpdate}>
        <div>
          <table cellPadding="10">
            <tbody>
              <tr>
                <td align="center" valign="top">
                  <img
                    src="/img/wxyc-logo-classic.gif"
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
                        <input type="text" name="name" />
                      </td>
                    </tr>
                    <tr>
                      <td align="right" className="label">
                        <b>DJ Name:</b>
                      </td>
                      <td>
                        <input type="text" name="djName" />
                      </td>
                    </tr>
                    <tr>
                      <td align="right" className="label">
                        <b>New Password:</b>
                      </td>
                      <td>
                        <input type="password" name="password" />
                      </td>
                    </tr>
                    <tr>
                      <td align="right" className="label">
                        <b>Confirm Password:</b>
                      </td>
                      <td>
                        <input type="password" name="confirmPassword" />
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={2} align="center">
                        <input type="submit" value="Submit" />
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </form>
    </div>
  ) : (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <AuthenticationGuard redirectTo="/login" savePath />
      <div style={{ marginBottom: 20 }}>
        <LeaveClassic />
      </div>
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
                    src="/img/wxyc-logo-classic.gif"
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
                          <input type="text" name="username" />
                        </td>
                      </tr>
                      <tr>
                        <td align="right" className="label">
                          <b>Password:</b>
                        </td>
                        <td>
                          <input type="password" name="password" />
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={2} align="center">
                          <input
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
    </div>
  );
}
