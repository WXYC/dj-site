"use client";

import { useRouter } from "next/navigation";
import { useShowControl } from "@/src/hooks/flowsheetHooks";
import { OpenHelp } from "@/src/utils/helpScreen";

export default function ActionsBar({
  onAddTalkset,
}: {
  onAddTalkset: () => void;
}) {
  const router = useRouter();
  const { live, leave } = useShowControl();

  // Ports tubafrenzy's EndShowServlet flow: signoff the radio show and
  // invalidate the session in one click.
  const endShow = () => {
    leave();
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
            <a href="/live" target="_blank">
              Last 24 Hours
            </a>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            {live ? (
              <a href="#" onClick={(e) => { e.preventDefault(); endShow(); }}>
                End Show
              </a>
            ) : (
              <span>Not currently live</span>
            )}
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
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
      </tbody>
    </table>
  );
}
