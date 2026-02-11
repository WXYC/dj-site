"use client";

import { useRouter } from "next/navigation";
import { useShowControl } from "@/src/hooks/flowsheetHooks";
import { useRegistry } from "@/src/hooks/authenticationHooks";

export default function ActionsBar({
  onAddTalkset,
  onAddBreakpoint,
  workingHour,
}: {
  onAddTalkset: () => void;
  onAddBreakpoint: () => void;
  workingHour?: number;
}) {
  const router = useRouter();
  const { live, leave } = useShowControl();
  const { info: userData } = useRegistry();

  const formatHour = (hour?: number) => {
    if (!hour) return "";
    const date = new Date(hour);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  };

  const handleLogout = () => {
    router.push("/login?loginAction=endSession");
  };

  return (
    <table cellPadding={2} align="center">
      <tbody>
        <tr>
          <td className="label" align="center">
            <a href="#" onClick={(e) => { e.preventDefault(); onAddTalkset(); }}>
              Add a Talkset!
            </a>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onAddBreakpoint();
              }}
            >
              Add a {formatHour(workingHour)} Breakpoint
            </a>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <a href="/live" target="_blank">
              Last 24 Hours
            </a>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            {live ? (
              <a href="#" onClick={(e) => { e.preventDefault(); leave(); }}>
                Sign Out When Finished!
              </a>
            ) : (
              <span>Not currently live</span>
            )}
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <a href="#" onClick={(e) => { e.preventDefault(); /* OpenHelp(); */ }}>
              Help
            </a>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }}>
              Log Out
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
