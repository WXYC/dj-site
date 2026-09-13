import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, setFieldValue, TEST_BACKEND_URL } from "@/tests/helpers";
import { COMPANY_AUTOCOMPLETE_MATCH } from "@/tests/helpers/company-autocomplete-mock";
import { rotationApi } from "@/lib/features/rotation/api";

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

vi.mock("@/src/components/experiences/classic/rotation/CompanyAutocomplete", async () => {
  const { createCompanyAutocompleteMock } = await import(
    "@/tests/helpers/company-autocomplete-mock"
  );
  return createCompanyAutocompleteMock();
});

import RotationReleaseModify from "@/src/components/experiences/classic/rotation/RotationReleaseModify";

const ROTATION_ID = 5001;
const ROW = `${TEST_BACKEND_URL}/library/rotation/${ROTATION_ID}`;
const FORMATS = `${TEST_BACKEND_URL}/library/formats`;

type Row = {
  id: number;
  album_id: number | null;
  rotation_bin: string;
  add_date: string;
  kill_date: string | null;
  artist_name: string | null;
  album_title: string | null;
  record_label: string | null;
  format_id: number | null;
  label_id: number | null;
};

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: ROTATION_ID,
    album_id: null,
    rotation_bin: "H",
    add_date: "2026-09-10",
    kill_date: null,
    artist_name: "Juana Molina",
    album_title: "DOGA",
    record_label: "Sonamos",
    format_id: 3,
    label_id: 5,
    ...overrides,
  };
}

/** Arranges the row read and the formats list, and captures the PATCH body. */
function arrange(overrides: Partial<Row> = {}) {
  const patched: { body?: unknown } = {};
  server.use(
    http.get(ROW, () => HttpResponse.json(row(overrides))),
    http.get(FORMATS, () =>
      HttpResponse.json([
        { id: 3, format_name: "CD" },
        { id: 4, format_name: "LP" },
      ]),
    ),
    http.patch(ROW, async ({ request }) => {
      patched.body = await request.json();
      return HttpResponse.json(row({ ...overrides, ...(patched.body as Partial<Row>) }));
    }),
  );
  return patched;
}

/** Renders the screen and waits for the row read to seed the form. */
async function renderLoaded(waitFor: RegExp | string = "Juana Molina") {
  const rendered = renderWithProviders(<RotationReleaseModify rotationId={ROTATION_ID} />);
  await screen.findByDisplayValue(waitFor);
  return rendered;
}

describe("classic RotationReleaseModify — rotationReleaseModify.jsp", () => {
  beforeEach(() => {
    arrange();
  });

  it("renders the JSP's field order and labels for every Backend-writable field", async () => {
    await renderLoaded();

    expect(screen.getByText(/Modify a Release in the rotation database/i)).toBeInTheDocument();
    expect(screen.getByText(/Click here to input 'Various Artists'/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Artist's Presentation Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Title of Release/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Format")).toBeInTheDocument();
    expect(screen.getByLabelText("Record Label")).toBeInTheDocument();
    expect(screen.getByLabelText("Date Added To Rotation")).toBeInTheDocument();
    expect(screen.getByLabelText("Date Removed From Rotation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Modify this record" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset to current values" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rotation Release List" })).toHaveAttribute(
      "href",
      "/dashboard/rotation",
    );
  });

  it("seeds every field from the row it is editing", async () => {
    await renderLoaded();

    expect(screen.getByLabelText(/Artist's Presentation Name/i)).toHaveValue("Juana Molina");
    expect(screen.getByLabelText(/Title of Release/i)).toHaveValue("DOGA");
    expect(screen.getByLabelText("Format")).toHaveValue("3");
    expect(screen.getByLabelText("Record Label")).toHaveValue("Sonamos");
    expect(screen.getByLabelText("Date Added To Rotation")).toHaveValue("2026-09-10");
  });

  // The bin has a real column and a real value, and no endpoint can change it:
  // the field-level editor accepts the key, answers 200 and leaves the bin
  // alone. A control that reports success and changes nothing is worse than no
  // control, so the value is stated and the affordance is not offered.
  it("states the rotation bin as text rather than offering radios that cannot save", async () => {
    await renderLoaded();

    expect(screen.getByText("Heavy")).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Heavy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Light" })).not.toBeInTheDocument();
    expect(screen.getByText(/rotation bin cannot be changed here/i)).toBeInTheDocument();
  });

  it("sends only the fields that changed, so one correction cannot reset the rest", async () => {
    const patched = arrange();
    const { user } = await renderLoaded();

    setFieldValue(screen.getByLabelText(/Title of Release/i), "Halo");
    await user.click(screen.getByRole("button", { name: "Modify this record" }));

    await waitFor(() => expect(patched.body).toEqual({ album_title: "Halo" }));
  });

  it("drops the stored label id when the label text is edited away from it", async () => {
    const patched = arrange();
    const { user } = await renderLoaded();

    setFieldValue(screen.getByLabelText("Record Label"), "Drag City");
    await user.click(screen.getByRole("button", { name: "Modify this record" }));

    await waitFor(() => expect(patched.body).toEqual({ record_label: "Drag City", label_id: null }));
  });

  it("carries the label's own id when the typed text resolves to an existing label", async () => {
    const patched = arrange({ record_label: "Drag City", label_id: 9 });
    const { user } = await renderLoaded("Drag City");

    setFieldValue(screen.getByLabelText("Record Label"), "sonamos");
    await user.click(screen.getByRole("button", { name: "match an existing label" }));
    await user.click(screen.getByRole("button", { name: "Modify this record" }));

    await waitFor(() =>
      expect(patched.body).toEqual({
        record_label: COMPANY_AUTOCOMPLETE_MATCH.label_name,
        label_id: COMPANY_AUTOCOMPLETE_MATCH.id,
      }),
    );
  });

  // The label search runs on mount against the text the row already holds, so
  // a row whose stored spelling matches an existing label resolves without
  // anyone touching the field. Staging that resolution writes a label_id the
  // librarian never chose -- and on a catalogued row turns a legal date edit
  // into a 409 over a field he cannot even see.
  it("stages nothing when the search resolves the label the row arrived with", async () => {
    const patched = arrange({ record_label: "Sonamos", label_id: null });
    const { user } = await renderLoaded("Sonamos");

    await user.click(screen.getByRole("button", { name: "match an existing label" }));
    await user.click(screen.getByRole("button", { name: "Modify this record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/nothing.*changed/i);
    expect(patched.body).toBeUndefined();
  });

  it("refuses a save with nothing changed instead of sending an empty patch", async () => {
    const patched = arrange();
    const { user } = await renderLoaded();

    await user.click(screen.getByRole("button", { name: "Modify this record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/nothing.*changed/i);
    expect(patched.body).toBeUndefined();
  });

  it.each([
    { field: /Artist's Presentation Name/i, message: "Please enter a presentation name." },
    { field: /Title of Release/i, message: "Please enter a title." },
  ])("refuses an emptied $message", async ({ field, message }) => {
    const patched = arrange();
    const { user } = await renderLoaded();

    setFieldValue(screen.getByLabelText(field), "");
    await user.click(screen.getByRole("button", { name: "Modify this record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(patched.body).toBeUndefined();
  });

  // The text trio has no clearing value on the wire: the endpoint validates
  // each as a non-empty string, so a blank one is a 400 rather than a cleared
  // column. The JSP's "self-released" link is gone for the same reason.
  it("refuses to clear a record label it cannot clear on the wire", async () => {
    const patched = arrange();
    const { user } = await renderLoaded();

    setFieldValue(screen.getByLabelText("Record Label"), "");
    await user.click(screen.getByRole("button", { name: "Modify this record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot be cleared/i);
    expect(patched.body).toBeUndefined();
  });

  it("confirms a successful save in place, the way the JSP's status message does", async () => {
    arrange();
    const { user } = await renderLoaded();

    await user.selectOptions(screen.getByLabelText("Format"), "4");
    await user.click(screen.getByRole("button", { name: "Modify this record" }));

    expect(await screen.findByRole("status")).toHaveTextContent(/modified/i);
  });

  it("states the server's own refusal inline rather than swallowing it", async () => {
    server.use(
      http.patch(ROW, () =>
        HttpResponse.json({ message: "album_title must be 128 characters or fewer" }, { status: 400 }),
      ),
    );
    const { user } = await renderLoaded();

    await user.selectOptions(screen.getByLabelText("Format"), "4");
    await user.click(screen.getByRole("button", { name: "Modify this record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/128 characters or fewer/i);
  });

  it("restores the loaded values on Reset", async () => {
    const { user } = await renderLoaded();

    setFieldValue(screen.getByLabelText(/Title of Release/i), "Halo");
    await user.click(screen.getByRole("button", { name: "Reset to current values" }));

    expect(screen.getByLabelText(/Title of Release/i)).toHaveValue("DOGA");
  });

  describe("kill date", () => {
    it("offers NONE only for a row that carries a kill date, and clears it as null", async () => {
      const patched = arrange({ kill_date: "2026-09-01" });
      const { user } = await renderLoaded();
      const select = screen.getByLabelText("Date Removed From Rotation");

      expect(within(select).getAllByRole("option", { name: "NONE" })).toHaveLength(1);

      await user.selectOptions(select, "");
      await user.click(screen.getByRole("button", { name: "Modify this record" }));

      await waitFor(() => expect(patched.body).toEqual({ kill_date: null }));
    });

    // The current value is the first option and NONE is not offered beside it:
    // there is nothing to clear, and the JSP's own `killDate > 0` test is what
    // gates that option there too.
    it("labels a never-killed row's current value NONE and offers no second one", async () => {
      await renderLoaded();
      const select = screen.getByLabelText("Date Removed From Rotation");

      expect(within(select).getAllByRole("option", { name: "NONE" })).toHaveLength(1);
      expect(select).toHaveValue("");
    });
  });

  describe("a row that is already catalogued", () => {
    // The library release owns the artist, title, label and format once the
    // row is linked, and the endpoint refuses a rotation-side write to any of
    // them. The dates are the two fields that stay writable in both states.
    it("offers only the two dates, and says where the rest are edited", async () => {
      arrange({ album_id: 42, artist_name: null, album_title: null, record_label: null });
      renderWithProviders(<RotationReleaseModify rotationId={ROTATION_ID} />);

      expect(await screen.findByText(/already catalogued/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Artist's Presentation Name/i)).toBeDisabled();
      expect(screen.getByLabelText(/Title of Release/i)).toBeDisabled();
      expect(screen.getByLabelText("Format")).toBeDisabled();
      expect(screen.getByLabelText("Record Label")).toBeDisabled();
      expect(screen.getByLabelText("Date Added To Rotation")).toBeEnabled();
      expect(screen.getByLabelText("Date Removed From Rotation")).toBeEnabled();
      expect(screen.getByRole("link", { name: /library release/i })).toHaveAttribute(
        "href",
        "/dashboard/library/release/42",
      );
    });
  });

  describe("a format the row never had", () => {
    // Most rotation rows predate the format column. Requiring one here would
    // refuse a kill-date correction over a field the librarian never touched,
    // and would refuse it unanswerably while a formats outage has the select
    // withdrawn -- the form could then never be submitted at all.
    it("saves a date correction on a row that carries no format", async () => {
      const patched = arrange({ format_id: null });
      const { user } = await renderLoaded();
      const killDate = screen.getByLabelText("Date Removed From Rotation");

      await user.selectOptions(killDate, within(killDate).getAllByRole("option")[1]);
      await user.click(screen.getByRole("button", { name: "Modify this record" }));

      await waitFor(() => expect(patched.body).toEqual({ kill_date: expect.any(String) }));
    });

    it("saves a date correction while the format list is unavailable", async () => {
      const patched = arrange({ format_id: null });
      server.use(http.get(FORMATS, () => HttpResponse.json(null, { status: 500 })));
      const { user } = await renderLoaded();
      const killDate = screen.getByLabelText("Date Removed From Rotation");

      await user.selectOptions(killDate, within(killDate).getAllByRole("option")[1]);
      await user.click(screen.getByRole("button", { name: "Modify this record" }));

      await waitFor(() => expect(patched.body).toEqual({ kill_date: expect.any(String) }));
    });

    // Clearing a format the row does have is the one case the JSP's rule still
    // speaks for: the endpoint would take the null and empty the column.
    it("refuses a format the librarian cleared", async () => {
      const patched = arrange();
      const { user } = await renderLoaded();

      await user.selectOptions(screen.getByLabelText("Format"), "");
      await user.click(screen.getByRole("button", { name: "Modify this record" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Please select a format.");
      expect(patched.body).toBeUndefined();
    });
  });

  describe("the baseline the form diffs against", () => {
    // The row can move under an editor someone still has open. Diffing against
    // the read rather than against the snapshot the form was seeded from turns
    // every field the other librarian touched into an explicit write-back: a
    // save meaning only to correct the add date would also send
    // `kill_date: null`, silently un-killing a row it never displayed as
    // killed.
    it("stays the row it was seeded from when the read moves underneath", async () => {
      const patched = arrange();
      const { user, store } = await renderLoaded();

      let reads = 0;
      server.use(
        http.get(ROW, () => {
          reads += 1;
          return HttpResponse.json(row({ kill_date: "2026-09-11" }));
        }),
      );
      store.dispatch(rotationApi.util.invalidateTags(["Rotation"]));
      await waitFor(() => expect(reads).toBeGreaterThan(0));

      const addDate = screen.getByLabelText("Date Added To Rotation");
      await user.selectOptions(addDate, within(addDate).getAllByRole("option")[1]);
      await user.click(screen.getByRole("button", { name: "Modify this record" }));

      await waitFor(() => expect(patched.body).toEqual({ add_date: expect.any(String) }));
    });

    it("advances to the saved values, so a second save has nothing left to send", async () => {
      const patched = arrange();
      const { user } = await renderLoaded();

      setFieldValue(screen.getByLabelText(/Title of Release/i), "Halo");
      await user.click(screen.getByRole("button", { name: "Modify this record" }));
      await screen.findByRole("status");
      await user.click(screen.getByRole("button", { name: "Modify this record" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(/nothing.*changed/i);
      expect(patched.body).toEqual({ album_title: "Halo" });
    });
  });

  describe("reads that do not answer", () => {
    it("says the release does not exist rather than showing an empty form", async () => {
      server.use(http.get(ROW, () => HttpResponse.json({ message: "not found" }, { status: 404 })));
      renderWithProviders(<RotationReleaseModify rotationId={ROTATION_ID} />);

      expect(await screen.findByRole("alert")).toHaveTextContent(/no such rotation release/i);
    });

    // A read that failed for any other reason is a different statement: the
    // release may well exist, so the screen must not claim it does not.
    it("distinguishes an unavailable read from a missing release", async () => {
      server.use(http.get(ROW, () => HttpResponse.json({ message: "boom" }, { status: 500 })));
      renderWithProviders(<RotationReleaseModify rotationId={ROTATION_ID} />);

      expect(await screen.findByRole("alert")).toHaveTextContent(/unavailable right now/i);
    });

    // An unissued or failed formats request must never render as an empty
    // option list -- an outage there would otherwise read as "this release has
    // no format", and picking one would overwrite the format it does have.
    it("says the format list is unavailable instead of offering an empty select", async () => {
      server.use(http.get(FORMATS, () => HttpResponse.json(null, { status: 500 })));
      renderWithProviders(<RotationReleaseModify rotationId={ROTATION_ID} />);
      await screen.findByDisplayValue("Juana Molina");

      expect(await screen.findByText(/Formats are unavailable/i)).toBeInTheDocument();
      expect(screen.getByLabelText("Format")).toBeDisabled();
    });
  });
});
