"use client";

import "@/src/styles/classic/wxyc.css";
import { useShowControl } from "@/src/hooks/flowsheetHooks";
import { useRegistry } from "@/src/hooks/authenticationHooks";
import { FormEvent } from "react";
import { OpenHelp } from "@/src/utils/helpScreen";

export default function StartShow() {
  const { goLive } = useShowControl();
  const { info: userData } = useRegistry();

  const handleStartShow = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    goLive();
  };

  // Format current time for display in disabled dropdown
  const getCurrentTimeDisplay = () => {
    const now = new Date();
    const hour = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const year = now.getFullYear().toString().slice(-2);
    return `${displayHour}:${minutes.toString().padStart(2, "0")} ${ampm} (${month}/${day}/${year})`;
  };

  return (
    <div style={{ width: "100%", margin: "0 auto" }}>
      <div style={{ textAlign: "center", width: "100%" }}>
        <table cellPadding={10} style={{ margin: "0 auto" }}>
        <tbody>
          <tr>
            <td align="center" valign="top" className="title">
              Flowsheet
            </td>
          </tr>
          <tr>
            <td align="center" valign="top" className="title">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  OpenHelp();
                }}
              >
                Help
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" valign="top" className="title">
              &nbsp;
            </td>
          </tr>
          <tr>
            <td align="center" className="title">
              Sign on as the on-air DJ below.
              <p></p>
              <em>
                ALSO: Remember to <u>sign in and out</u> of the (paper)
                operator&apos;s log in the control room!
              </em>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
      <p></p>
      <form name="userpw" onSubmit={handleStartShow}>
        <div style={{ textAlign: "center", width: "100%" }}>
          <table cellPadding={10} style={{ margin: "0 auto" }}>
            <tbody>
              <tr>
                <td align="right" className="title">
                  <b>Real Name of DJ:</b>
                </td>
                <td>
                  <input
                    type="text"
                    name="djName"
                    value={userData?.real_name || ""}
                    disabled
                    style={{
                      backgroundColor: "#f0f0f0",
                      color: "#666",
                      cursor: "not-allowed",
                    }}
                  />
                  <input type="hidden" name="djID" value="0" />
                </td>
              </tr>
              <tr>
                <td align="right" className="title">
                  <b>Starting Time:</b>
                </td>
                <td className="smalltext">
                  <select
                    name="startingHour"
                    disabled
                    style={{
                      backgroundColor: "#f0f0f0",
                      color: "#666",
                      cursor: "not-allowed",
                    }}
                  >
                    <option value="0">{getCurrentTimeDisplay()}</option>
                  </select>
                </td>
              </tr>
              <tr>
                <td align="right" className="label">
                  <b>Show Name:</b>
                </td>
                <td className="smalltext">
                  <input
                    type="text"
                    name="showName"
                    placeholder="(optional)"
                    disabled
                    style={{
                      backgroundColor: "#f0f0f0",
                      color: "#666",
                      cursor: "not-allowed",
                    }}
                  />
                  &nbsp;(optional)
                </td>
              </tr>
              <tr>
                <td align="right" className="label">
                  <b>Public DJ Handle:</b>
                </td>
                <td className="smalltext">
                  <input
                    type="text"
                    name="djHandle"
                    value={userData?.dj_name || ""}
                    placeholder="(optional)"
                    disabled
                    style={{
                      backgroundColor: "#f0f0f0",
                      color: "#666",
                      cursor: "not-allowed",
                    }}
                  />
                  &nbsp;(optional)
                </td>
              </tr>
              <tr>
                <td colSpan={2} align="center">
                  <input
                    type="submit"
                    value="Sign on and Start the Show!"
                    style={{ cursor: "pointer" }}
                  />
                </td>
              </tr>
              <tr>
                <td colSpan={2} align="center">
                  <input
                    type="reset"
                    value="Reset to default values"
                    disabled
                    style={{
                      backgroundColor: "#f0f0f0",
                      color: "#666",
                      cursor: "not-allowed",
                    }}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </form>
      <p></p>
      <div style={{ textAlign: "center", width: "100%" }}>
        <form name="resumeShow">
          <input type="hidden" name="mode" value="modifyFlowsheet" />
          <input type="hidden" name="clearMessage" value="yes" />
          <table cellPadding={10} style={{ margin: "0 auto" }}>
            <tbody>
              <tr>
                <td align="right" className="title">
                  <b>Shifts from the Last 24 Hours:</b>
                </td>
                <td className="smalltext">
                  <select
                    name="radioShowID"
                    disabled
                    style={{
                      backgroundColor: "#f0f0f0",
                      color: "#666",
                      cursor: "not-allowed",
                    }}
                  >
                    <option value="0">
                      Resume functionality not available
                    </option>
                  </select>
                </td>
              </tr>
              <tr>
                <td colSpan={2} align="center" className="smalltext" style={{ color: "#666" }}>
                  Resume show functionality requires backend support for listing
                  open shows, which is not currently available.
                </td>
              </tr>
              <tr>
                <td colSpan={2} align="center">
                  <input
                    type="submit"
                    value="Resume This Show!"
                    disabled
                    style={{
                      backgroundColor: "#f0f0f0",
                      color: "#666",
                      cursor: "not-allowed",
                    }}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </form>
      </div>
    </div>
  );
}
