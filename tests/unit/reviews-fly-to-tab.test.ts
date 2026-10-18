import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { moveRowToTab } from "@/src/components/experiences/modern/reviews/flyToTab";

const TAB = "/dashboard/reviews/mine";

const stubMotion = ({ reduce }: { reduce: boolean }) => {
  const animate = vi.fn(() => ({ finished: Promise.resolve(), cancel: vi.fn() }));
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduce && query === "(prefers-reduced-motion: reduce)" }));
  HTMLElement.prototype.animate = animate as unknown as HTMLElement["animate"];
  return animate;
};

const draw = (cover: string) => {
  document.body.innerHTML = `
    <a data-tab="${TAB}" href="${TAB}">My reviews<span data-tab-count="${TAB}">2</span></a>
    <ul><li id="row"><div>${cover}</div><button>Review</button></li></ul>`;
  return document.getElementById("row") as HTMLElement;
};

describe("moveRowToTab", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });
  afterEach(() => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
    vi.unstubAllGlobals();
  });

  it("makes no animation call under reduced motion", async () => {
    const animate = stubMotion({ reduce: true });
    await moveRowToTab(draw("<img alt='' src='/c.png'>"), TAB);
    expect(animate).not.toHaveBeenCalled();
  });

  it("makes no animation call where the browser has no Web Animations API", async () => {
    stubMotion({ reduce: false });
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
    await expect(moveRowToTab(draw("<img alt='' src='/c.png'>"), TAB)).resolves.toBeUndefined();
  });

  it.each([
    ["an img cover", "<img alt='' src='/c.png'>"],
    ["an aria-hidden placeholder cover", "<span aria-hidden='true'>S</span>"],
  ])("flies a decorative copy of %s to the tab's count and collapses the row, then removes the copy", async (_name, cover) => {
    const animate = stubMotion({ reduce: false });
    const row = draw(cover);
    const bodyChildren = document.body.children.length;

    const moving = moveRowToTab(row, TAB);
    const clone = document.body.lastElementChild as HTMLElement;
    expect(document.body.children.length).toBe(bodyChildren + 1);
    expect(clone).toHaveAttribute("aria-hidden", "true");
    await moving;

    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate.mock.instances).toEqual(expect.arrayContaining([clone, row]));
    expect(animate).toHaveBeenCalledWith(expect.objectContaining({ height: expect.any(Array), opacity: [1, 0] }), expect.objectContaining({ duration: 500, fill: "forwards" }));
    expect(clone.isConnected).toBe(false);
  });

  it("flies to the tab link when the tab has no count pill", async () => {
    const animate = stubMotion({ reduce: false });
    const row = draw("<img alt='' src='/c.png'>");
    row.ownerDocument.querySelector("[data-tab-count]")?.remove();

    await moveRowToTab(row, TAB);

    expect(animate).toHaveBeenCalledTimes(2);
  });

  it("resolves and removes the copy when an animation is cancelled", async () => {
    stubMotion({ reduce: false });
    HTMLElement.prototype.animate = vi.fn(() => ({ finished: Promise.reject(new Error("cancelled")), cancel: vi.fn() })) as unknown as HTMLElement["animate"];

    await expect(moveRowToTab(draw("<img alt='' src='/c.png'>"), TAB)).resolves.toBeUndefined();

    expect(document.querySelectorAll("body > [aria-hidden='true']")).toHaveLength(0);
  });
});
