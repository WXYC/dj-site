import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { digitalItem, fakeReviewsEndpoints, intakeItem, renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { Authorization } from "@/lib/features/admin/types";

// The bench's artist field is gated by AuthorizedView, which resolves the music director tier from the session.
const listUsers = vi.hoisted(() => vi.fn());
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    admin: { listUsers },
    useSession: () => ({
      data: { user: { id: "md-me", email: "md@wxyc.org", name: "MD", username: "md", role: null, emailVerified: true } },
      isPending: false,
      error: null,
    }),
  },
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));
vi.mock("@/lib/features/authentication/organization-config", () => ({
  getAppOrganizationIdClient: vi.fn(() => undefined),
}));
vi.mock("@/lib/features/authentication/organization-utils", () => ({
  fetchOrganizationRoleForUserClient: vi.fn().mockResolvedValue("musicDirector"),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), info: vi.fn(), dismiss: vi.fn() }),
}));

vi.mock("next/font/google", () => ({ Kanit: () => ({ style: { fontFamily: "Kanit, sans-serif" } }) }));
vi.mock("next/font/local", () => ({ default: () => ({ style: { fontFamily: "Minbus, sans-serif" } }) }));

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const getParam = vi.hoisted(() => new URLSearchParams());
vi.mock("next/navigation", async () => {
  const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
  return createNavigationModuleMock(router, { search: () => getParam.toString() });
});

const mockAuth = vi.hoisted(() => ({ id: "md-me", authority: 2 as number }));
vi.mock("@/src/hooks/authenticationHooks", async () => {
  const { createAuthenticationHookMock } = await import("@/tests/helpers/auth-hook-mock");
  return createAuthenticationHookMock(mockAuth);
});


import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import type { IntakeItemPatch } from "@wxyc/shared";
import { CssVarsProvider } from "@mui/joy/styles";
import modernTheme from "@/lib/features/experiences/modern/theme";
import IntakeItemScreen from "@/src/components/experiences/modern/reviews/IntakeItemScreen";

const ITEM_ID = 11;
const ITEM_PATH = `${TEST_BACKEND_URL}/intake/${ITEM_ID}`;
const EDIT = "Edit";

const dogaItem = (overrides = {}) =>
  intakeItem({
    id: ITEM_ID,
    artist_name: "Juana Molina",
    album_title: "DOGA",
    record_label: "Sonamos",
    label_id: 4,
    bandcamp_url: "https://juanamolina.bandcamp.com/album/doga",
    state: "reviewed",
    effective_state: "reviewed",
    submitted_review_count: 1,
    accepted_review_id: null,
    ...overrides,
  });

/** Serves the record through a box and accepts its PATCH, applying the body as the server would; returns the bodies sent. */
const serve = (start: ReturnType<typeof dogaItem>, refuse?: { reason: string }) => {
  const box = { item: start, reads: 0 };
  const sent: IntakeItemPatch[] = [];
  fakeReviewsEndpoints({ records: [start], forItem: { [ITEM_ID]: [] } });
  server.use(
    http.get(ITEM_PATH, () => {
      box.reads += 1;
      return HttpResponse.json(box.item);
    }),
    http.patch(ITEM_PATH, async ({ request }) => {
      const body = (await request.json()) as IntakeItemPatch;
      sent.push(body);
      if (refuse) {
        box.item = dogaItem({ state: "filed", effective_state: "filed" });
        return HttpResponse.json({ message: "server words", reason: refuse.reason }, { status: 409 });
      }
      box.item = { ...box.item, ...body } as typeof box.item;
      return HttpResponse.json(box.item);
    }),
  );
  return { box, sent };
};

const renderScreen = () => renderWithProviders(<CssVarsProvider theme={modernTheme}>{<IntakeItemScreen id={ITEM_ID} />}</CssVarsProvider>);

const openEdit = async (user: ReturnType<typeof renderScreen>["user"]) => {
  await user.click(await screen.findByRole("button", { name: EDIT }));
  return screen.getByRole("form", { name: EDIT });
};

const replace = async (user: ReturnType<typeof renderScreen>["user"], label: RegExp | string, text: string) => {
  const field = screen.getByLabelText(label);
  await user.clear(field);
  if (text) await user.type(field, text);
};

describe("IntakeItemScreen edit", () => {
  beforeEach(() => {
    mockAuth.authority = Authorization.MD;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/artists/search`, () => HttpResponse.json({ artists: [] })),
      http.get(`${TEST_BACKEND_URL}/labels/search`, () => HttpResponse.json([])),
    );
  });

  it("opens a form prefilled with the record's artist, album, label and Bandcamp link", async () => {
    serve(dogaItem());
    const { user } = renderScreen();
    await openEdit(user);

    expect(screen.getByLabelText(/^Artist/)).toHaveValue("Juana Molina");
    expect(screen.getByLabelText(/^Album/)).toHaveValue("DOGA");
    expect(screen.getByLabelText(REVIEW_COPY.intake.label)).toHaveValue("Sonamos");
    expect(screen.getByLabelText(REVIEW_COPY.intake.bandcampUrl)).toHaveValue("https://juanamolina.bandcamp.com/album/doga");
  });

  it("sends only the changed fields, and no label_id for label text that is not a picked row", async () => {
    const { sent } = serve(dogaItem());
    const { user } = renderScreen();
    await openEdit(user);

    await replace(user, /^Label/, "Sonamos Records");
    await replace(user, REVIEW_COPY.intake.bandcampUrl, "https://juanamolina.bandcamp.com/album/doga-2");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ record_label: "Sonamos Records", bandcamp_url: "https://juanamolina.bandcamp.com/album/doga-2" });
    await waitFor(() => expect(screen.queryByRole("form", { name: EDIT })).not.toBeInTheDocument());
  });

  it("sends label_id with the label name while the text still matches the picked row", async () => {
    const { sent } = serve(dogaItem({ record_label: null, label_id: null }));
    server.use(http.get(`${TEST_BACKEND_URL}/labels/search`, () => HttpResponse.json([{ id: 41, label_name: "Drag City" }])));
    const { user } = renderScreen();
    await openEdit(user);

    await user.type(screen.getByRole("combobox", { name: "Search labels" }), "Drag");
    await user.click(await screen.findByRole("option", { name: /Drag City/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ record_label: "Drag City", label_id: 41 });
  });

  it("clears the label with record_label and label_id null, and the Bandcamp link with null", async () => {
    const { sent } = serve(dogaItem());
    const { user } = renderScreen();
    await openEdit(user);

    await replace(user, /^Label/, "");
    await replace(user, REVIEW_COPY.intake.bandcampUrl, "");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ record_label: null, label_id: null, bandcamp_url: null });
  });

  it("sends the album and artist when they change", async () => {
    const { sent } = serve(dogaItem());
    const { user } = renderScreen();
    await openEdit(user);

    await replace(user, /^Album/, "Halo");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ album_title: "Halo" });
  });

  it("keeps Save off while nothing has changed, so an empty patch is never sent", async () => {
    const { sent } = serve(dogaItem());
    const { user } = renderScreen();
    await openEdit(user);

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await user.type(screen.getByLabelText(/^Album/), "x");
    await user.type(screen.getByLabelText(/^Album/), "{Backspace}");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(sent).toHaveLength(0);
  });

  it("sends nothing when the form is submitted with no change", async () => {
    const { sent, box } = serve(dogaItem());
    const { user } = renderScreen();
    const form = await openEdit(user);
    const reads = box.reads;

    fireEvent.submit(form);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sent).toHaveLength(0);
    expect(box.reads).toBe(reads);
  });

  it("keeps Save off for a Bandcamp link the form refuses", async () => {
    serve(dogaItem());
    const { user } = renderScreen();
    await openEdit(user);

    await replace(user, REVIEW_COPY.intake.bandcampUrl, "http://example.com/x");

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("shows the already-filed line and rereads the record when the save meets a 409 already_filed", async () => {
    const { box } = serve(dogaItem(), { reason: "already_filed" });
    const { user } = renderScreen();
    await openEdit(user);
    const reads = box.reads;

    await replace(user, /^Album/, "Halo");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(REVIEW_COPY.intakeItem.alreadyFiled)).toBeInTheDocument();
    expect(box.reads).toBeGreaterThan(reads);
    expect(screen.queryByText("server words")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: EDIT })).not.toBeInTheDocument();
  });

  it("leaves the form open and says the write failed when the save fails for another reason", async () => {
    serve(dogaItem());
    server.use(http.patch(ITEM_PATH, () => HttpResponse.json({ message: "boom" }, { status: 500 })));
    const { user } = renderScreen();
    await openEdit(user);

    await replace(user, /^Album/, "Halo");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(REVIEW_COPY.screen.writeFailed)).toBeInTheDocument();
    expect(screen.getByRole("form", { name: EDIT })).toBeInTheDocument();
  });

  it("shows the format field for a disc", async () => {
    serve(dogaItem({ format_id: 1 }));
    const { user } = renderScreen();
    await openEdit(user);

    expect(screen.getByRole("combobox", { name: /^Format/ })).toBeInTheDocument();
  });

  it("hides the format field for a digital item", async () => {
    serve(digitalItem({ id: ITEM_ID, artist_name: "Juana Molina", album_title: "DOGA", state: "reviewed", effective_state: "reviewed" }));
    const { user } = renderScreen();
    await openEdit(user);

    expect(screen.queryByRole("combobox", { name: /^Format/ })).not.toBeInTheDocument();
  });

  it("offers no Edit to a DJ", async () => {
    mockAuth.authority = Authorization.DJ;
    serve(dogaItem());
    renderScreen();

    await screen.findByText("DOGA");
    expect(screen.queryByRole("button", { name: EDIT })).not.toBeInTheDocument();
  });

  it.each(["filed", "finalized"] as const)("offers no Edit on a %s record", async (state) => {
    serve(dogaItem({ state, effective_state: state }));
    renderScreen();

    await screen.findByText("DOGA");
    expect(screen.queryByRole("button", { name: EDIT })).not.toBeInTheDocument();
  });
});
