import { Profiler } from "react";
import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return {
    ...createAuthClientModuleMock(),
    getJWTToken: vi.fn(async () => "test-token"),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import RotationReleaseModify from "@/src/components/experiences/classic/rotation/RotationReleaseModify";

const ROTATION_ID = 5001;
const ROW = `${TEST_BACKEND_URL}/library/rotation/${ROTATION_ID}`;
const FORMATS = `${TEST_BACKEND_URL}/library/formats`;
const LABEL_SEARCH = `${TEST_BACKEND_URL}/labels/search`;

// Longer than the autocomplete's 300 ms debounce, so a window that observes
// "nothing is happening" has actually let the search fire and settle first. A
// window shorter than the debounce reports quiet that has not started yet.
const IDLE_MS = 500;

const idle = () => new Promise((resolve) => setTimeout(resolve, IDLE_MS));

/**
 * The one spec that renders the real `CompanyAutocomplete` rather than the
 * module stand-in its siblings use. The interaction under test lives in the
 * seam between the two — the autocomplete's post-search resolution calling
 * back into this screen's state — and a stand-in for either side cannot
 * exercise it.
 *
 * The arrangement is the common one, not a corner case: the add form stores
 * the canonical label spelling, so a row's own `record_label` is exactly what
 * the label search returns for it, and the resolution fires on mount for
 * every such row without anyone typing.
 */
describe("classic RotationReleaseModify — the seeded label against a live label search", () => {
  function arrange() {
    const patched: { body?: unknown } = {};
    server.use(
      http.get(ROW, () =>
        HttpResponse.json({
          id: ROTATION_ID,
          album_id: null,
          rotation_bin: "H",
          add_date: "2026-09-10",
          kill_date: null,
          artist_name: "Juana Molina",
          album_title: "DOGA",
          record_label: "Sonamos",
          format_id: 3,
          label_id: null,
        }),
      ),
      http.get(FORMATS, () => HttpResponse.json([{ id: 3, format_name: "CD" }])),
      http.get(LABEL_SEARCH, ({ request }) => {
        const query = new URL(request.url).searchParams.get("q")?.toLowerCase() ?? "";
        return HttpResponse.json(
          [
            { id: 17, label_name: "Sonamos" },
            { id: 23, label_name: "Drag City" },
          ].filter((label) => label.label_name.toLowerCase().startsWith(query)),
        );
      }),
      http.patch(ROW, async ({ request }) => {
        patched.body = await request.json();
        return HttpResponse.json({});
      }),
    );
    return patched;
  }

  async function renderProfiled() {
    const onRender = vi.fn();
    const rendered = renderWithProviders(
      <Profiler id="rotation-release-modify" onRender={onRender}>
        <RotationReleaseModify rotationId={ROTATION_ID} />
      </Profiler>,
    );
    await screen.findByDisplayValue("Juana Molina");
    await waitFor(() => {
      expect(rendered.container.querySelector('datalist option[value="Sonamos"]')).not.toBeNull();
    });
    return { ...rendered, onRender };
  }

  // A resolution that feeds back into the screen's state is a loop unless the
  // state update bails out: the callback the autocomplete's effect depends on
  // is recreated by the very re-render that update causes. The renders land on
  // the task queue rather than inside one commit, so no count taken at a
  // single moment can see it -- the loop shows only as a count that keeps
  // climbing while nothing is happening, which is why this samples twice.
  //
  // The second sample is a bound, not an equality: a late straggler render is
  // legitimate and shows up under load, while a loop adds renders by the dozen
  // per window, so any small ceiling separates them. Equality fails on the
  // straggler, and a flaky guard on a loop is a guard that gets muted.
  it("settles instead of re-rendering itself once the search confirms the seeded label", async () => {
    arrange();

    const { onRender } = await renderProfiled();
    await idle();
    const rendersOnceIdle = onRender.mock.calls.length;
    await idle();

    expect(onRender.mock.calls.length - rendersOnceIdle).toBeLessThanOrEqual(2);
  });

  // The case above settles before the resolution ever runs: a field still
  // holding what the row arrived with has nothing to resolve. This is the live
  // path, where the resolution does fire — it feeds the matched label back into
  // the same state the autocomplete reads from, so it is bounded only by the
  // update refusing to allocate when the value it would write is already there.
  it("settles after resolving a label the librarian typed", async () => {
    arrange();

    const { onRender, user, container } = await renderProfiled();
    const field = screen.getByLabelText(/Record Label/i);
    await user.clear(field);
    await user.type(field, "Drag City");

    // The resolution cannot fire until the debounced search for the new text
    // has returned, and the narrowed option list is the proof that it did.
    await waitFor(
      () => {
        expect(container.querySelector('datalist option[value="Drag City"]')).not.toBeNull();
        expect(container.querySelector('datalist option[value="Sonamos"]')).toBeNull();
      },
      { timeout: 3000 },
    );

    await idle();
    const rendersOnceIdle = onRender.mock.calls.length;
    await idle();

    expect(onRender.mock.calls.length - rendersOnceIdle).toBeLessThanOrEqual(2);
  });

  it("stages nothing from a resolution of the label the row already holds", async () => {
    const patched = arrange();

    const { user } = await renderProfiled();
    await user.click(screen.getByRole("button", { name: "Modify this record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/nothing.*changed/i);
    expect(patched.body).toBeUndefined();
  });
});
