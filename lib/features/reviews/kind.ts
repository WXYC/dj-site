import type { IntakeItem } from "@wxyc/shared";

/** A record whose review is already on the library entry: nothing is left to file. */
export const isFiledState = (state: IntakeItem["effective_state"]): boolean => state === "filed" || state === "finalized";

/** Which kind of record this is: a file the library holds as a digital album, or a physical disc. */
export const recordKind = (item: Pick<IntakeItem, "digital">): "digital" | "disc" => (item.digital ? "digital" : "disc");

/** The value for the record's kind, so a screen that differs by kind names both branches. */
export const byKind = <T,>(item: Pick<IntakeItem, "digital">, values: { disc: T; digital: T }): T => values[recordKind(item)];

/** A digital album reads Digital until it is filed; once filed it is a disc and reads its format. */
export const showsAsDigital = (item: Pick<IntakeItem, "digital" | "effective_state">): boolean =>
  item.digital && !isFiledState(item.effective_state);
