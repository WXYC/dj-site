import React from 'react';

export default function CLASSIC_LoginPage({
  handlePasswordChange,
  handleUserNameChange,
  login
}) {

    const handleSubmit = (event) => {
        event.preventDefault();
        login();
    }

  return (
      <form name="userpw" onSubmit={handleSubmit}>
        <input type="hidden" name="loginAction" value="userpw" />
        <div align="center">
          <table cellPadding="10">
            <tr>
              <td align="center" valign="top">
                <img src="img/wxyc-logo-classic.gif" alt="WXYC logo" border="0" />
              </td>
            </tr>
          </table>
          <table cellPadding="10" height="90%">
            <tr>
              <td align="center">
                <span className="title">
                  Please log in to WXYC Library:
                </span>
                <br />
                <table cellPadding="10">
                  <tr>
                    <td align="right" className="label">
                      <b>User Login:</b>
                    </td>
                    <td>
                      <input type="text" name="user" />
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
                      <input type="submit" value="Submit User ID and Password" />
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} align="center">
                      <input type="reset" value="Reset to default values" />
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>
      </form>
  );
}
