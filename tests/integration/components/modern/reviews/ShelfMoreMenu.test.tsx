import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import type { ReactElement } from "react";
import type { IntakeItem } from "@wxyc/shared";
import { Authorization } from "@/lib/features/admin/types";
import { useGetReviewersQuery } from "@/lib/features/reviews/reviewApi";
import { digitalItem, fakeReviewsEndpoints, intakeItem, renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), dismiss: vi.fn() }),
}));

const url = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock({ push: vi.fn(), replace: vi.fn() }, { pathname: "/dashboard/reviews/music-directors", search: () => url.search });
});

const mockAuth = vi.hoisted(() => ({ id: "md-me", authority: 2 as number }));
vi.mock("@/src/hooks/authenticationHooks", async () => {
  const { createAuthenticationHookMock } = await import("@/tests/helpers/auth-hook-mock");
  return createAuthenticationHookMock(mockAuth);
});

import { toast } from "sonner";
import IntakeLanes from "@/src/components/experiences/modern/reviews/IntakeLanes";
import ReviewShelfScreen from "@/src/components/experiences/modern/reviews/ReviewShelfScreen";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import { useReviewWrite } from "@/src/components/experiences/modern/reviews/useReviewWrite";

const COPY = REVIEW_COPY.intake;
const MORE = COPY.moreButton;
const REVIEWERS = [
  { id: "dj-sam", name: "DJ Sam" },
  { id: "dj-pat", name: "Pat Placeholder" },
];
const DOGA = intakeItem({ id: 1, artist_name: "Juana Molina", album_title: "DOGA", record_label: "Sonamos" });

function ShelfTab({ items, isMD }: { items: IntakeItem[]; isMD: boolean }) {
  const reviewers = useGetReviewersQuery(undefined, { skip: !isMD });
  const { write, lock } = useReviewWrite();
  return <ReviewShelfScreen items={items} isMD={isMD} reviewers={reviewers} write={write} lock={lock} />;
}

/** The two places a music director's review shelf control is drawn. */
const SURFACES: { name: string; draw: (items: IntakeItem[], isMD: boolean) => ReactElement; hasCheckout: boolean }[] = [
  { name: "the Review shelf tab", draw: (items, isMD) => <ShelfTab items={items} isMD={isMD} />, hasCheckout: true },
  {
    name: "the On the review shelf stage",
    draw: () => {
      url.search = "?stage=review_shelf";
      return <IntakeLanes />;
    },
    hasCheckout: false,
  },
];

const serve = (rows: IntakeItem[]) => fakeReviewsEndpoints({ open: rows, reviewers: REVIEWERS });

/** The row for a record, once it has loaded. */
const rowOf = async (artist: string) => {
  const link = await screen.findByRole("link", { name: artist });
  return link.closest("li")!;
};

const moreOf = async (artist: string, album: string) =>
  within(await rowOf(artist)).findByRole("button", { name: `${MORE} ${artist} ${album}` });

const ITEMS = [
  ["Ask a DJ…", COPY.askADj, COPY.moreAskDescription],
  ["Use a review we already have…", COPY.moreCite, COPY.moreCiteDescription],
  ["Digitize a review…", COPY.moreRecord, COPY.moreRecordDescription],
] as const;

beforeEach(() => {
  url.search = "";
  mockAuth.authority = Authorization.MD;
  vi.stubEnv("NEXT_PUBLIC_REVIEWS_ENABLED", "staff");
  vi.mocked(toast).mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe.each(SURFACES)("the music director's More menu on $name", ({ draw, hasCheckout }) => {
  it("draws a button named More for its record, with a menu, in place of a standalone Ask a DJ… button", async () => {
    serve([DOGA]);
    renderWithProviders(draw([DOGA], true));

    const more = await moreOf("Juana Molina", "DOGA");
    expect(more).toHaveAttribute("aria-haspopup", "menu");
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(within(await rowOf("Juana Molina")).queryByRole("button", { name: /^Ask a DJ…/ })).not.toBeInTheDocument();
  });

  it("lists the three ways to get a review in order, each with its description", async () => {
    serve([DOGA]);
    const { user } = renderWithProviders(draw([DOGA], true));

    await user.click(await moreOf("Juana Molina", "DOGA"));

    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    expect(items).toHaveLength(3);
    ITEMS.forEach(([name, , description], index) => {
      expect(within(menu).getByRole("menuitem", { name, description })).toBe(items[index]);
    });
  });

  it.each([
    ["Use a review we already have…", "cite"],
    ["Digitize a review…", "record"],
  ])("takes %s to the record's page with ?get=%s", async (name, get) => {
    serve([DOGA]);
    const { user } = renderWithProviders(draw([DOGA], true));

    await user.click(await moreOf("Juana Molina", "DOGA"));

    const item = await screen.findByRole("menuitem", { name });
    expect(item.tagName).toBe("A");
    expect(item).toHaveAttribute("href", `/dashboard/admin/intake/1?get=${get}`);
  });

  it("opens the picker from Ask a DJ…, and the request still posts and raises the Asked toast", async () => {
    const asked: string[] = [];
    serve([DOGA]);
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/1/request`, async ({ request }) => {
        asked.push(((await request.json()) as { dj_id: string }).dj_id);
        return HttpResponse.json({ ...DOGA, state: "requested", effective_state: "requested" });
      }),
    );
    const { user } = renderWithProviders(draw([DOGA], true));

    await user.click(await moreOf("Juana Molina", "DOGA"));
    await user.click(await screen.findByRole("menuitem", { name: COPY.askADj }));
    await user.type(await within(await screen.findByRole("dialog")).findByRole("combobox"), "Pat Placeholder");
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("button", { name: COPY.ask }));

    await waitFor(() => expect(asked).toEqual(["dj-pat"]));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(COPY.askDone("Pat Placeholder"), expect.anything()));
  });

  it("opens with Enter, moves with the arrow keys, and returns focus to More on Escape", async () => {
    serve([DOGA]);
    const { user } = renderWithProviders(draw([DOGA], true));

    const more = await moreOf("Juana Molina", "DOGA");
    more.focus();
    await user.keyboard("{Enter}");
    const menu = await screen.findByRole("menu");
    const [first, second] = within(menu).getAllByRole("menuitem");
    await waitFor(() => expect(first).toHaveFocus());
    await user.keyboard("{ArrowDown}");
    expect(second).toHaveFocus();
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(more);
  });

  describe("after the picker closes", () => {
    const openPicker = async (user: ReturnType<typeof renderWithProviders>["user"]) => {
      const more = await moreOf("Juana Molina", "DOGA");
      await user.click(more);
      await user.click(await screen.findByRole("menuitem", { name: COPY.askADj }));
      await screen.findByRole("dialog");
      return more;
    };

    it.each([
      [
        "Cancel",
        async (user: ReturnType<typeof renderWithProviders>["user"]) => {
          await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }));
        },
      ],
      [
        "Escape",
        async (user: ReturnType<typeof renderWithProviders>["user"]) => {
          await user.keyboard("{Escape}");
        },
      ],
      [
        "Ask, while the request is in flight",
        async (user: ReturnType<typeof renderWithProviders>["user"]) => {
          await user.type(await within(await screen.findByRole("dialog")).findByRole("combobox"), "Pat Placeholder");
          await user.keyboard("{Enter}");
          await user.click(await screen.findByRole("button", { name: COPY.ask }));
        },
      ],
    ])("puts focus on More after %s", async (_how, close) => {
      serve([DOGA]);
      server.use(
        http.post(`${TEST_BACKEND_URL}/intake/1/request`, async () => {
          await delay(300);
          return HttpResponse.json({ ...DOGA, state: "requested", effective_state: "requested" });
        }),
      );
      const { user } = renderWithProviders(draw([DOGA], true));

      const more = await openPicker(user);
      await close(user);

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(more).toBeEnabled();
      expect(document.activeElement).toBe(more);
    });

    it("locks only the Ask a DJ… item while its request is in flight, leaving More usable", async () => {
      serve([DOGA]);
      server.use(
        http.post(`${TEST_BACKEND_URL}/intake/1/request`, async () => {
          await delay(300);
          return HttpResponse.json({ ...DOGA, state: "requested", effective_state: "requested" });
        }),
      );
      const { user } = renderWithProviders(draw([DOGA], true));

      const more = await openPicker(user);
      await user.type(await within(await screen.findByRole("dialog")).findByRole("combobox"), "Pat Placeholder");
      await user.keyboard("{Enter}");
      await user.click(await screen.findByRole("button", { name: COPY.ask }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

      await user.click(more);
      expect(await screen.findByRole("menuitem", { name: COPY.askADj })).toHaveAttribute("aria-disabled", "true");
      expect(screen.getByRole("menuitem", { name: "Use a review we already have…" })).not.toHaveAttribute("aria-disabled", "true");
    });
  });

  it.each([
    ["a disc", DOGA, REVIEW_COPY.screen.checkOut],
    ["a digital album", digitalItem({ id: 2, artist_name: "Sessa", album_title: "Pequena Vertigem de Amor" }), REVIEW_COPY.screen.take],
  ])(`keeps the primary button beside More for %s only where a record can be checked out`, async (_kind, record, primary) => {
    serve([record]);
    renderWithProviders(draw([record], true));

    const row = await rowOf(record.artist_name);
    await within(row).findByRole("button", { name: new RegExp(`^${MORE}`) });
    expect(within(row).queryAllByRole("button", { name: primary })).toHaveLength(hasCheckout ? 1 : 0);
  });
});

// The music directors' tab is closed to a DJ, so only the Review shelf tab ever draws a DJ's rows.
it("gives a DJ on the Review shelf tab no More and no Ask a DJ…", async () => {
  mockAuth.authority = Authorization.DJ;
  serve([DOGA]);
  renderWithProviders(<ShelfTab items={[DOGA]} isMD={false} />);

  expect(await screen.findByRole("button", { name: REVIEW_COPY.screen.checkOut })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: new RegExp(`^${MORE}`) })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^Ask a DJ…/ })).not.toBeInTheDocument();
});
