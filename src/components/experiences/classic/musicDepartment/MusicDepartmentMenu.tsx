import Link from "next/link";
import { Fragment } from "react";

import { isClassicCrossReferencesEnabled } from "@/lib/features/catalog/flags";

import MusicDepartmentLogOutLink from "./MusicDepartmentLogOutLink";
import MusicDepartmentSearchForm from "./MusicDepartmentSearchForm";

/**
 * `/wxycdb`'s top-level menu, `mainmenu.jsp`: the search box over the
 * librarian's links, each an `<h3>`, which is why these are not the nav bar's
 * list styling. The JSP renders no on-page heading -- its `<title>` is just
 * `WXYC` -- so neither does this.
 *
 * Four of the JSP's entries are absent because dj-site has no screen behind
 * them: Format Tallysheets (the rotation tallysheet was retired, not
 * rebuilt), Manage Labels, Rebuild Search Indexes and Admin Settings. A dead
 * link would be the only alternative.
 *
 * The two cross-reference views do have screens, but their entries are
 * flag-gated: Backend-Service serves their endpoints only once
 * `isClassicCrossReferencesEnabled` can be turned on, and until then an entry
 * would lead a librarian to a screen the API cannot answer. Both stay
 * URL-reachable and server-gated either way.
 */

type MenuLink = { href: string; title: string };

// Between `chooseLibraryCodePrompt` and Missing Releases, where `mainmenu.jsp`
// puts them.
const CROSSREFERENCE_LINKS: MenuLink[] = [
  {
    href: "/dashboard/library/crossreferences/artists",
    title: "View Library Code Cross-References",
  },
  {
    href: "/dashboard/library/crossreferences/releases",
    title: "View Library Release Cross-References",
  },
];

// `mainmenu.jsp` breaks its list exactly once, with a `<p>&nbsp;</p>` after
// Missing Releases. That gap is the menu's only grouping, so it is reproduced
// rather than collapsed.
//
// Built per render, not once at module load: the flag is inlined at build
// time, so a module-level constant would freeze whatever value the build saw
// into a shape tests and server renders could not vary.
function menuGroups(): MenuLink[][] {
  return [
    [
      { href: "/dashboard/library", title: "Add, Edit, & Delete Artists & Releases" },
      ...(isClassicCrossReferencesEnabled() ? CROSSREFERENCE_LINKS : []),
      { href: "/dashboard/library/missing", title: "Missing Releases" },
    ],
    [
      { href: "/dashboard/rotation", title: "Rotation Releases" },
      { href: "/dashboard/rotation/new", title: "Add Rotation Releases" },
    ],
  ];
}

export default function MusicDepartmentMenu() {
  return (
    <>
      <MusicDepartmentSearchForm />
      <div style={{ textAlign: "center" }}>
        {menuGroups().map((group, index) => (
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
