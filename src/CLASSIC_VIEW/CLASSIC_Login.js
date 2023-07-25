import React from 'react';
import { useAuth } from '../services/authentication/authentication-context';
import { Navigate } from 'react-router-dom';

export default function CLASSIC_LoginPage() {

  const { handleLogin, handlePasswordUpdate, resetPasswordRequired, isAuthenticated } = useAuth();

  return (<>
  {isAuthenticated && <Navigate to="/" replace />}
  {resetPasswordRequired ? (
    <form name="userpw" onSubmit={handlePasswordUpdate}>
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
                Please update your information:
              </span>
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
          </table>
        </div>
    </form>
  )
  : (
      <form name="userpw" onSubmit={handleLogin}>
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
                  Please log in to WXYC Library and Flowsheet:
                </span>
                <br />
                <table cellPadding="10">
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
  )}
  </>);
}
