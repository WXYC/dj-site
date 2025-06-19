"use client";

import { Button, ButtonProps, IconButton, IconButtonProps, MenuItem, MenuItemProps } from "@mui/joy";
import { useRouter } from "next/navigation";

export function LinkButton({
  href,
  children,
  ...props
}: ButtonProps & { href: string }) {
  const router = useRouter();

  return href.startsWith("http") ? (
    <Button component="a" href={href} {...props}>
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
  ...props
}: IconButtonProps & { href: string }) {
  const router = useRouter();

  return href.startsWith("http") ? (
    <IconButton component={"a"} href={href} {...props}>
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
  ...props
}: MenuItemProps & { href: string }) {
  const router = useRouter();

  return (
    <MenuItem
      variant="plain"
      color="neutral"
      onClick={() => router.push(href)}
      {...props}
    >
      {children}
    </MenuItem>
  );
}