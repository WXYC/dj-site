import Link from "next/link";

import MusicDepartmentSearchForm from "./MusicDepartmentSearchForm";

/**
 * The librarian's menu, merging `/wxycdb`'s two menu screens: the search box
 * and first two links come from `libraryAdmin/libraryAdminLinks.jsp`, the
 * rotation pair from `rotation/musicmenu.jsp` (whose `<title>` supplies the
 * heading). Both render their links as `<h3>`, which is why these are not the
 * nav bar's list styling.
 *
 * `musicmenu.jsp`'s third link, Format Tallysheets, is deliberately absent:
 * wiki#89 decision D5 drops the rotation tallysheet, so there is no screen to
 * point at and a dead link would be the only alternative.
 */
const MENU_LINKS = [
  { href: "/dashboard/library", title: "Create or Find Artists By Library Code" },
  { href: "/dashboard/library/missing", title: "Missing Releases" },
  { href: "/dashboard/rotation", title: "Rotation Releases" },
  { href: "/dashboard/rotation/new", title: "Add Rotation Releases" },
];

export default function MusicDepartmentMenu() {
  return (
    <>
      <span className="title">WXYC Music Department application</span>
      <MusicDepartmentSearchForm />
      <div style={{ textAlign: "center" }}>
        {MENU_LINKS.map((link) => (
          <h3 key={link.href}>
            <Link href={link.href}>{link.title}</Link>
          </h3>
        ))}
      </div>
    </>
  );
}
