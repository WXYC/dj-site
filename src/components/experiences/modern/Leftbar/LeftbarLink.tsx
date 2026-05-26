"use client";

import JoyNextLink from "@/src/components/shared/JoyNextLink";
import { Badge, ListItem, ListItemButton, Tooltip } from "@mui/joy";
import { usePathname } from "next/navigation";

export type LeftbarLinkProps = {
  path: string;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
};

export default function LeftbarLink(props: LeftbarLinkProps): JSX.Element {
  const pathname = usePathname();

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
          variant={pathname === props.path ? "solid" : "plain"}
          aria-label={props.title}
          {...(!props.disabled && {
            component: JoyNextLink,
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
