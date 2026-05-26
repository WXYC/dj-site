"use client";

import { Badge, ListItem, ListItemButton, Tooltip } from "@mui/joy";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type LeftbarLinkProps = {
  path: string;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
};

const linkWrapperSx = {
  display: "flex",
  width: "100%",
  textDecoration: "none",
  color: "inherit",
} as const;

export default function LeftbarLink(props: LeftbarLinkProps): JSX.Element {
  const pathname = usePathname();
  const isActive = pathname === props.path;

  const button = (
    <ListItemButton
      disabled={props.disabled}
      variant={isActive ? "solid" : "plain"}
      aria-label={props.title}
      sx={{ width: "100%" }}
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
  );

  return (
    <ListItem>
      <Tooltip
        title={props.title}
        arrow={true}
        placement="right"
        size="sm"
        variant="outlined"
      >
        <span style={{ display: "flex", width: "100%" }}>
          {props.disabled ? (
            button
          ) : (
            <Link href={props.path} style={linkWrapperSx}>
              {button}
            </Link>
          )}
        </span>
      </Tooltip>
    </ListItem>
  );
}
