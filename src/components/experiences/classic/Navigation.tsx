"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLogout, useRegistry } from "@/src/hooks/authenticationHooks";
import { isClassicLibrarianNavEnabled } from "@/lib/features/catalog/flags";
import { Authorization } from "@/lib/features/admin/types";
import AuthorizedView from "@/src/components/shared/Authorization/AuthorizedView";
import "@/src/styles/classic/wxyc.css";

type NavLink = {
  path: string;
  title: string;
  /**
   * Minimum authority for the link to be shown. Hiding is cosmetic only — each
   * destination page enforces its own authority server-side, and that gate is
   * what actually protects the screen. A link shown in error costs a redirect,
   * never access.
   */
  requiredRole?: Authorization;
  /**
   * Extra path prefixes this entry is the bar's name for. The Music
   * Department menu owns the library screens, which live under a different
   * path than the menu itself.
   */
  activePrefixes?: string[];
};

// Styled as tubafrenzy's .nav-bar (its public-page navigation): dark #333
// bar, bold white links, active page highlighted #CC0000. The bar itself is
// the one sanctioned addition over tubafrenzy's DJ pages, which have no
// cross-page navigation.
export default function Navigation() {
  const pathname = usePathname();
  const { handleLogout } = useLogout();
  const { info: userData, loading: registryLoading } = useRegistry();

  // The control-room browser is shared, and no other classic screen says whose
  // session is open: the sign-on form's disabled name field reads as the
  // system's fixed idea of who is at the keyboard rather than a session anyone
  // can end. Real name over handle — the question is who is signed in, not what
  // they are called on air. Absent rather than blank when nothing resolves; an
  // empty slot asserting an identity is worse than no assertion.
  const signedInName = userData?.real_name || userData?.dj_name || "";

  const navLinks: NavLink[] = [
    { path: "/dashboard/catalog", title: "Card Catalog" },
    { path: "/dashboard/flowsheet", title: "Flowsheet" },
    { path: "/dashboard/playlists", title: "Previous Sets" },
  ];

  // Mirrors tubafrenzy's mainmenu, which wraps only the add/edit surfaces in an
  // admin check: missing releases and rotation sit outside it and are reachable
  // by any logged-in user. Marking a release missing or found is deliberately
  // DJ-accessible and must not be raised to music director.
  const librarianLinks: NavLink[] = [
    { path: "/dashboard/library/missing", title: "Missing Releases" },
    { path: "/dashboard/rotation", title: "Rotation" },
    {
      path: "/dashboard/md",
      title: "Music Department",
      requiredRole: Authorization.MD,
      // The catalog entry point (/dashboard/library) is reached from the menu
      // rather than the bar, so the menu is what the bar highlights while the
      // librarian is inside those screens. /dashboard/rotation is deliberately
      // absent: the Rotation entry above already names it.
      activePrefixes: ["/dashboard/library"],
    },
  ];

  const visibleLinks = [
    ...navLinks,
    ...(isClassicLibrarianNavEnabled() ? librarianLinks : []),
  ];

  const matchLength = (link: NavLink) => {
    if (!pathname) return 0;
    return [link.path, ...(link.activePrefixes ?? [])]
      .filter((path) => pathname === path || pathname.startsWith(path + "/"))
      .reduce((longest, path) => Math.max(longest, path.length), 0);
  };

  // Longest match wins, so exactly one entry is ever highlighted. Matching
  // each link independently lit both Missing Releases and the entry that
  // prefixes it whenever the librarian was on /dashboard/library/missing.
  const longestMatch = visibleLinks.reduce(
    (longest, link) => Math.max(longest, matchLength(link)),
    0
  );

  const isActive = (link: NavLink) => {
    const length = matchLength(link);
    return length > 0 && length === longestMatch;
  };

  const renderLink = (link: NavLink) => {
    const item = (
      <Link
        href={link.path}
        className={isActive(link) ? "active" : undefined}
      >
        {link.title}
      </Link>
    );

    // The authority check wraps the whole <li>, not its contents: an
    // unauthorized or still-resolving check must remove the bar slot entirely
    // rather than leave an empty list item behind.
    if (link.requiredRole !== undefined) {
      return (
        <AuthorizedView key={link.path} requiredRole={link.requiredRole}>
          <li>{item}</li>
        </AuthorizedView>
      );
    }

    return <li key={link.path}>{item}</li>;
  };

  return (
    <nav className="nav-bar">
      <ul>
        {navLinks.map(renderLink)}
        {isClassicLibrarianNavEnabled() && librarianLinks.map(renderLink)}
        {!registryLoading && signedInName && (
          <li>
            <span className="nav-identity">{signedInName}</span>
          </li>
        )}
        <li>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleLogout();
            }}
          >
            Log Out
          </a>
        </li>
      </ul>
    </nav>
  );
}
