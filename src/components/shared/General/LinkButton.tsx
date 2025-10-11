"use client";

import {
  Button,
  ButtonProps,
  IconButton,
  IconButtonProps,
  MenuItem,
  MenuItemProps,
} from "@mui/joy";
import { useRouter } from "next/navigation";

export function LinkButton({
  href,
  children,
  target,
  ...props
}: ButtonProps & { href: string; target?: string }) {
  const router = useRouter();

  return href.startsWith("http") ? (
    <Button component="a" href={href} target={target} {...props}>
      {children}
    </Button>
  ) : (
    <Button onClick={() => router.push(href)} {...props}>
      {children}
    </Button>
  );
}

export function LinkIconButton({
  href,
  children,
  target,
  ...props
}: IconButtonProps & { href: string; target?: string }) {
  const router = useRouter();

  return href.startsWith("http") ? (
    <IconButton component={"a"} href={href} target={target} {...props}>
      {children}
    </IconButton>
  ) : (
    <IconButton onClick={() => router.push(href)} {...props}>
      {children}
    </IconButton>
  );
}

export function MenuLinkItem({
  href,
  children,
  target,
  ...props
}: MenuItemProps & { href: string; target?: string }) {
  const router = useRouter();

  return (
    <MenuItem
      variant="plain"
      color="neutral"
      onClick={() => router.push(href)}
      target={target}
      {...props}
    >
      {children}
    </MenuItem>
  );
}
