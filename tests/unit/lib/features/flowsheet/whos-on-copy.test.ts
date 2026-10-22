import { describe, it, expect } from "vitest";
import {
  WHOS_ON_ROLES,
  isSpotlightDisabled,
  whosOnCopy,
  whosOnMessage,
} from "@/lib/features/flowsheet/whos-on-copy";

describe("whos-on copy", () => {
  it("offers the five roles in menu order, each with its menu label", () => {
    expect(WHOS_ON_ROLES.map(({ role, menu }) => [role, menu])).toEqual([
      ["performer", "Live in the studio"],
      ["reader", "Reading now"],
      ["dj", "Now mixing"],
      ["guest", "Guest"],
      ["host", "Host"],
    ]);
  });

  it.each([
    ["performer", "Porch Static", "Porch Static live in the studio"],
    ["reader", "Ada Limón", "Ada Limón reading now"],
    ["dj", "Static Cling", "Static Cling mixing"],
    ["guest", "Jessica Pratt", "Jessica Pratt in the studio as a guest"],
    ["host", "DJ Chowder", "DJ Chowder hosting"],
  ] as const)("words a %s row as the name then the role", (role, name, expected) => {
    expect(whosOnMessage(role, name)).toBe(expected);
  });

  it("never says spotlight in a string a DJ reads", () => {
    const strings = [
      ...WHOS_ON_ROLES.flatMap(({ menu, row }) => [menu, row]),
      ...Object.values(whosOnCopy).flatMap((value) =>
        typeof value === "function"
          ? [value("dj"), value("guest"), value("performer")]
          : [value]
      ),
    ];
    for (const text of strings) {
      expect(text.toLowerCase()).not.toContain("spotlight");
    }
  });

  it("asks for the name they DJ under on a dj entry, and a plain name otherwise", () => {
    expect(whosOnCopy.nameLabel("dj")).toBe("The name they DJ under");
    expect(whosOnCopy.nameLabel("guest")).toBe("Name");
  });

  it("adds the guest line to the public-name notice for a guest only", () => {
    expect(whosOnCopy.publicNotice("guest")).toBe(
      "This name shows in the listener apps. Use the name your guest wants public."
    );
    expect(whosOnCopy.publicNotice("performer")).toBe(
      "This name shows in the listener apps."
    );
  });

  it.each([
    [{ status: 403, data: { code: "spotlight_disabled" } }, true],
    [{ status: 403, data: { code: "closed_show" } }, false],
    [{ status: 400, data: { code: "spotlight_disabled" } }, false],
    [{ status: 403 }, false],
    [undefined, false],
  ])("recognises a spotlight_disabled refusal: %j -> %s", (error, expected) => {
    expect(isSpotlightDisabled(error)).toBe(expected);
  });
});
