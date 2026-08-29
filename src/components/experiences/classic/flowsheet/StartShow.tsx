"use client";

import "@/src/styles/classic/wxyc.css";
import { useShowControl } from "@/src/hooks/flowsheetHooks";
import { useGoLiveHandoff } from "@/src/hooks/goLiveHandoffHooks";
import { describeOpenShow } from "@/lib/features/flowsheet/go-live-handoff";
import { useRegistry } from "@/src/hooks/authenticationHooks";
import { FormEvent, useEffect, useState } from "react";
import { OpenHelp } from "@/src/utils/helpScreen";

export default function StartShow() {
  const { goLive } = useShowControl();
  // Same decision as the modern surface, rendered in this page's own plain
  // markup rather than through a Joy dialog — nothing else in classic uses Joy.
  // Without it a classic DJ gets a form that appears to do nothing, which is
  // the dead end this prompt exists to remove, only relocated.
  const { prompt, deciding, requestGoLive, decide, cancel } =
    useGoLiveHandoff(goLive);
  const { info: userData, loading: registryLoading } = useRegistry();
  // Editable per-show override for the DJ's public handle, initialized to the
  // registry's `dj_name`. useRegistry() is async, so useState's initializer
  // (which only runs once) can't wait for it — this effect syncs the field
  // until the user edits it, after which their in-progress value wins even
  // if the registry refetches. See #694 + BS#1295.
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
    // The override is handed to the prompt, not recomputed after it: this form
    // reads the registry at submit time, and re-deriving it on the far side of
    // a dialog would silently drop the handle the DJ typed.
    void requestGoLive(override);
  };

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
                  {/* Disabled until the registry resolves: `goLive` sends
                      nothing without it, so a live button here would be a form
                      that silently does nothing — the dead end this prompt
                      exists to remove. Modern gates the same way on `loading`. */}
                  <input
                    type="submit"
                    value="Sign on and Start the Show!"
                    disabled={registryLoading || !userData}
                    style={{
                      cursor: registryLoading || !userData ? "not-allowed" : "pointer",
                    }}
                  />
                </td>
              </tr>
              {prompt && (
                <tr>
                  <td colSpan={2} align="center">
                    <div
                      className="smalltext go-live-handoff-prompt"
                      role="alert"
                      data-testid="go-live-handoff-prompt"
                    >
                      <b>{describeOpenShow(prompt.handoff)}</b>
                      <p>
                        Join them as a co-host, or end their show and start your
                        own.
                      </p>
                      <input
                        type="button"
                        value="Join Existing Show"
                        disabled={deciding}
                        onClick={() => void decide("join")}
                        style={{ cursor: "pointer" }}
                        data-testid="go-live-handoff-join"
                      />
                      &nbsp;
                      {/* Red because it signs somebody else off the air. */}
                      <input
                        type="button"
                        className="handoff-danger"
                        value="End Existing Show"
                        disabled={deciding}
                        onClick={() => void decide("takeover")}
                        style={{ cursor: "pointer" }}
                        data-testid="go-live-handoff-takeover"
                      />
                      &nbsp;
                      <input
                        type="button"
                        value="Cancel"
                        disabled={deciding}
                        onClick={cancel}
                        style={{ cursor: "pointer" }}
                        data-testid="go-live-handoff-cancel"
                      />
                    </div>
                  </td>
                </tr>
              )}
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
