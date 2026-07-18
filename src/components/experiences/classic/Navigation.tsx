"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLogout } from "@/src/hooks/authenticationHooks";
import "@/src/styles/classic/wxyc.css";

type NavLink = {
  path: string;
  title: string;
  disabled?: boolean;
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

  const isActive = (path: string) => {
    if (!pathname) return false;
    return pathname === path || pathname.startsWith(path + "/");
  };

  return (
    <nav className="nav-bar">
      <ul>
        {navLinks.map((link) => (
          <li key={link.path}>
            {link.disabled ? (
              <span className="nav-disabled">{link.title}</span>
            ) : (
              <Link
                href={link.path}
                className={isActive(link.path) ? "active" : undefined}
              >
                {link.title}
              </Link>
            )}
          </li>
        ))}
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
