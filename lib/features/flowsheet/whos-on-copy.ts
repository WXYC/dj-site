import type { SpotlightRole } from "@wxyc/shared";

type RoleCopy = {
  role: SpotlightRole;
  /** The role menu's entry. */
  menu: string;
  /** What follows the name in a row: "Porch Static live in the studio". */
  row: string;
};

/** The roles in menu order. The wire calls these rows "spotlight"; the DJ site never does. */
export const WHOS_ON_ROLES: readonly RoleCopy[] = [
  { role: "performer", menu: "Live in the studio", row: "live in the studio" },
  { role: "reader", menu: "Reading now", row: "reading now" },
  { role: "dj", menu: "Now mixing", row: "mixing" },
  { role: "guest", menu: "Guest", row: "in the studio as a guest" },
  { role: "host", menu: "Host", row: "hosting" },
];

/**
 * A row's text as one line: the name, then its role. The server also sends a
 * `message` for these rows; the live flowsheet words them itself so an
 * optimistic row and the row the server returns read alike. Previous Sets, the
 * archive stream and the classic read-only table still show the server's
 * message until the rendering slice lands. A role this build does not know
 * degrades to the server's message, as an unknown entry type does.
 */
export function whosOnMessage(
  role: SpotlightRole,
  name: string,
  serverMessage: string = name
): string {
  const row = WHOS_ON_ROLES.find((r) => r.role === role)?.row;
  return row === undefined ? serverMessage : `${name} ${row}`;
}

/** Every string the who's-on control shows. */
export const whosOnCopy = {
  title: "Who's on",
  guestTooltip: "Add a guest",
  tooltip: "Add who's on",
  roleLabel: "Role",
  nameLabel: (role: SpotlightRole) =>
    role === "dj" ? "The name they DJ under" : "Name",
  publicNotice: (role: SpotlightRole) =>
    role === "guest"
      ? "This name shows in the listener apps. Use the name your guest wants public."
      : "This name shows in the listener apps.",
  add: "Add",
  disabled: "Who's on air isn't turned on yet.",
};

/** The server's 403 while who's-on rows are switched off; told apart by its `code`, never its text. */
export function isSpotlightDisabled(error: unknown): boolean {
  const { status, data } = (error ?? {}) as { status?: unknown; data?: unknown };
  return (
    status === 403 &&
    (data as { code?: unknown } | null | undefined)?.code === "spotlight_disabled"
  );
}
