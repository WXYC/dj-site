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

export default function LeftbarLink(props: LeftbarLinkProps): JSX.Element {
  const pathname = usePathname();

  return (
    <Link
      aria-disabled={props.disabled}
      href={props.path}
      prefetch={props.disabled ? false : undefined}
      style={{
        pointerEvents: props.disabled ? "none" : "auto",
      }}
    >
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
          >
            <Badge
              anchorOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              badgeInset={"-50%"}
              badgeContent={null} // will be non-empty when DJ is live
              size="sm"
            >
              {props.children}
            </Badge>
          </ListItemButton>
        </Tooltip>
      </ListItem>
    </Link>
  );
}
