"use client";
import type { JSX } from "react";
import { Badge, ListItem, ListItemButton, Tooltip } from "@mui/joy";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type LeftbarLinkProps = {
  path: string;
  title: string;
  disabled?: boolean;
  /** Source of a RegExp for the pathnames on which this entry is current; absent means an exact match on `path`. */
  activePattern?: string;
  children: React.ReactNode;
};

export default function LeftbarLink(props: LeftbarLinkProps): JSX.Element {
  const pathname = usePathname();
  const current = props.activePattern
    ? new RegExp(props.activePattern).test(pathname)
    : pathname === props.path;

  return (
    <ListItem>
      <Tooltip
        title={props.title}
        arrow={true}
        placement="right"
        size="sm"
        variant="outlined"
      >
        <ListItemButton
          disabled={props.disabled}
          variant={current ? "solid" : "plain"}
          {...(!props.disabled && {
            component: Link,
            href: props.path,
          })}
        >
            <Badge
              anchorOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              badgeInset={"-50%"}
              badgeContent={null}
              size="sm"
            >
              {props.children}
            </Badge>
          </ListItemButton>
        </Tooltip>
      </ListItem>
  );
}
