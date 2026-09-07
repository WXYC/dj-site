import Link from "next/link";
import { Fragment } from "react";

import MusicDepartmentLogOutLink from "./MusicDepartmentLogOutLink";
import MusicDepartmentSearchForm from "./MusicDepartmentSearchForm";

/**
 * `/wxycdb`'s top-level menu, `mainmenu.jsp`: the search box over the
 * librarian's links, each an `<h3>`, which is why these are not the nav bar's
 * list styling. The JSP renders no on-page heading -- its `<title>` is just
 * `WXYC` -- so neither does this.
 *
 * Six of the JSP's entries are absent because dj-site has no screen behind
 * them: Format Tallysheets (the rotation tallysheet was retired, not
 * rebuilt), the two library cross-reference views, Manage Labels, Rebuild
 * Search Indexes and Admin Settings. A dead link would be the only
 * alternative.
 */

// `mainmenu.jsp` breaks its list exactly once, with a `<p>&nbsp;</p>` after
// Missing Releases. That gap is the menu's only grouping, so it is reproduced
// rather than collapsed.
const MENU_GROUPS: { href: string; title: string }[][] = [
  [
    { href: "/dashboard/library", title: "Add, Edit, & Delete Artists & Releases" },
    { href: "/dashboard/library/missing", title: "Missing Releases" },
  ],
  [
    { href: "/dashboard/rotation", title: "Rotation Releases" },
    { href: "/dashboard/rotation/new", title: "Add Rotation Releases" },
  ],
];

export default function MusicDepartmentMenu() {
  return (
    <>
      <MusicDepartmentSearchForm />
      <div style={{ textAlign: "center" }}>
        {MENU_GROUPS.map((group, index) => (
          <Fragment key={group[0].href}>
            {index > 0 && <p>&nbsp;</p>}
            {group.map((link) => (
              <h3 key={link.href}>
                <Link href={link.href}>{link.title}</Link>
              </h3>
            ))}
          </Fragment>
        ))}
        <h3>
          <MusicDepartmentLogOutLink />
        </h3>
      </div>
    </>
  );
}
