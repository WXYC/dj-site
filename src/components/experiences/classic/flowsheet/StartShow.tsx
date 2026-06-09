"use client";

import "@/src/styles/classic/wxyc.css";
import { useShowControl } from "@/src/hooks/flowsheetHooks";
import { useRegistry } from "@/src/hooks/authenticationHooks";
import { FormEvent, useEffect, useState } from "react";
import { OpenHelp } from "@/src/utils/helpScreen";

export default function StartShow() {
  const { goLive } = useShowControl();
  const { info: userData } = useRegistry();
  // Editable per-show override for the DJ's public handle. Initialized to
  // the registry's `dj_name` so the user sees their current value and can
  // type over it. See #694 + BS#1295.
  //
  // `useRegistry()` is async: the first render is typically `info: null`
  // and `userData?.dj_name` lands on a later render. `useState`'s
  // initializer only runs once, so we sync the editable state to the
  // registry value via `useEffect` until the user types into the field.
  // After the user edits, their in-progress value wins even if the
  // registry refetches.
  const registryDjHandle = userData?.dj_name ?? "";
  const [djHandle, setDjHandle] = useState(registryDjHandle);
  const [userEditedDjHandle, setUserEditedDjHandle] = useState(false);

  useEffect(() => {
    if (!userEditedDjHandle) {
      setDjHandle(registryDjHandle);
    }
  }, [registryDjHandle, userEditedDjHandle]);

  const handleStartShow = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Pass the override only when the user-typed value is non-empty after
    // trimming AND differs from the *current* registry value (read at
    // submit time, not captured at mount). This keeps the comparison
    // stable against a mid-form registry refetch: if the registry value
    // matches what the user typed at submit time, no override fires.
    const currentRegistryValue = (userData?.dj_name ?? "").trim();
    const trimmed = djHandle.trim();
    const override =
      trimmed.length > 0 && trimmed !== currentRegistryValue
        ? trimmed
        : undefined;
    goLive(override);
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
                    value={djHandle}
                    onChange={(e) => {
                      setUserEditedDjHandle(true);
                      setDjHandle(e.target.value);
                    }}
                    placeholder="(optional)"
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
