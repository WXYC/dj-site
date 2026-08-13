"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLogout } from "@/src/hooks/authenticationHooks";
import { isClassicLibrarianNavEnabled } from "@/lib/features/catalog/flags";
import { Authorization } from "@/lib/features/admin/types";
import AuthorizedView from "@/src/components/shared/Authorization/AuthorizedView";
import "@/src/styles/classic/wxyc.css";

type NavLink = {
  path: string;
  title: string;
  disabled?: boolean;
  /**
   * Minimum authority for the link to be shown. Hiding is cosmetic only — each
   * destination page enforces its own authority server-side, and that gate is
   * what actually protects the screen. A link shown in error costs a redirect,
   * never access.
   */
  requiredRole?: Authorization;
};

// Styled as tubafrenzy's .nav-bar (its public-page navigation): dark #333
// bar, bold white links, active page highlighted #CC0000. The bar itself is
// the one sanctioned addition over tubafrenzy's DJ pages, which have no
// cross-page navigation.
export default function Navigation() {
  const pathname = usePathname();
  const { handleLogout } = useLogout();

  const navLinks: NavLink[] = [
    { path: "/dashboard/catalog", title: "Card Catalog" },
    { path: "/dashboard/flowsheet", title: "Flowsheet" },
    { path: "/dashboard/playlists", title: "Previous Sets", disabled: true },
  ];

  // Mirrors tubafrenzy's mainmenu, which wraps only the add/edit surfaces in an
  // admin check: missing releases and rotation sit outside it and are reachable
  // by any logged-in user. Marking a release missing or found is deliberately
  // DJ-accessible and must not be raised to music director.
  const librarianLinks: NavLink[] = [
    {
      path: "/dashboard/library",
      title: "Add/Modify Catalog",
      requiredRole: Authorization.MD,
    },
    { path: "/dashboard/library/missing", title: "Missing Releases" },
    { path: "/dashboard/rotation", title: "Rotation" },
  ];

  const isActive = (path: string) => {
    if (!pathname) return false;
    return pathname === path || pathname.startsWith(path + "/");
  };

  const renderLink = (link: NavLink) => {
    const item = link.disabled ? (
      <span className="nav-disabled">{link.title}</span>
    ) : (
      <Link
        href={link.path}
        className={isActive(link.path) ? "active" : undefined}
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
