"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Joy's MenuList, used without a Dropdown, never moves focus into itself, so
 * its keyboard handling (arrows, Escape) would never receive a key. The
 * returned callback ref focuses the first enabled item once the list is in the
 * DOM — a portalled Popper mounts its content a render later than the menu's
 * owner, so a plain effect would find no list — and focus goes back to
 * `returnTo` when the menu unmounts, so a keyboard user lands where they
 * started.
 */
export function useMenuFocus<T extends HTMLElement>(returnTo: HTMLElement | null) {
  const listNode = useRef<T | null>(null);
  const ref = useCallback((node: T | null) => {
    if (node == null) return;
    listNode.current = node;
    // Deferred a frame: the list's own roving focus settles on its first item
    // as it mounts, which may be a disabled one. With every item disabled the
    // list itself takes focus, so Escape still reaches it.
    requestAnimationFrame(() => {
      if (!node.isConnected) return;
      const item = node.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])');
      if (item) {
        item.focus();
      } else {
        node.tabIndex = -1;
        node.focus();
      }
    });
  }, []);

  useEffect(
    () => () => {
      // Only reclaim focus the menu still holds (or that fell to the body as
      // it unmounted): an item that opened something focusable, such as an
      // inline rename input, keeps it.
      const active = document.activeElement;
      const menuHeldFocus =
        active == null || active === document.body || listNode.current?.contains(active);
      if (menuHeldFocus && returnTo?.isConnected) returnTo.focus();
    },
    [returnTo],
  );

  return ref;
}
