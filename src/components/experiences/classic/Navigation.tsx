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

export default function Navigation() {
  const pathname = usePathname();
  const { handleLogout } = useLogout();
  
  const navLinks: NavLink[] = [
    { path: "/dashboard/catalog", title: "Card Catalog" },
    { path: "/dashboard/flowsheet", title: "Flowsheet" },
    { path: "/dashboard/playlists", title: "Previous Sets", disabled: true },
    { path: "/dashboard/settings", title: "Settings" },
  ];

  const isActive = (path: string) => {
    if (!pathname) return false;
    // Check if current path matches or starts with the nav link path
    return pathname === path || pathname.startsWith(path + "/");
  };

  return (
    <table
      cellPadding={5}
      cellSpacing={0}
      border={0}
      width="100%"
      style={{ marginBottom: "20px", borderBottom: "2px solid #AAAAAA" }}
    >
      <tbody>
        <tr>
          <td align="center" className="label" style={{ padding: "5px 10px" }}>
            <span className="smalltext" style={{ color: "#666666" }}>
              Navigation:&nbsp;&nbsp;
            </span>
            {navLinks.map((link, index) => {
              const active = isActive(link.path);
              return (
                <span key={link.path}>
                  {link.disabled ? (
                    <span
                      className="smalltext"
                      style={{
                        color: "#999999",
                        textDecoration: "none",
                        cursor: "not-allowed",
                      }}
                    >
                      {link.title}
                    </span>
                  ) : (
                    <Link
                      href={link.path}
                      style={{
                        textDecoration: active ? "underline" : "none",
                        color: active ? "#FF0000" : "#0000EE",
                        fontWeight: active ? "bold" : "normal",
                      }}
                      className="smalltext"
                    >
                      {link.title}
                    </Link>
                  )}
                  {index < navLinks.length - 1 && (
                    <span className="smalltext" style={{ color: "#666666" }}>
                      &nbsp;&nbsp;|&nbsp;&nbsp;
                    </span>
                  )}
                </span>
              );
            })}
            <span className="smalltext" style={{ color: "#666666" }}>
              &nbsp;&nbsp;|&nbsp;&nbsp;
            </span>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handleLogout();
              }}
              style={{
                textDecoration: "none",
                color: "#0000EE",
              }}
              className="smalltext"
            >
              Log Out
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
