import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { COMPANY_AUTOCOMPLETE_MATCH } from "@/tests/helpers/company-autocomplete-mock";

vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import("@/tests/helpers/auth-client-mock");
  return {
    ...createAuthClientModuleMock(),
    getJWTToken: vi.fn(async () => "test-token"),
  };
});

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/src/components/experiences/classic/rotation/CompanyAutocomplete", async () => {
  const { createCompanyAutocompleteMock } = await import(
    "@/tests/helpers/company-autocomplete-mock"
  );
  return createCompanyAutocompleteMock();
});

import RotationReleaseInsert from "@/src/components/experiences/classic/rotation/RotationReleaseInsert";

const BASE = `${TEST_BACKEND_URL}/library/rotation`;
const FORMATS = `${TEST_BACKEND_URL}/library/formats`;

/** Fills the three fields the JSP marks required, in its own order. */
async function fillRequiredFields(user: ReturnType<typeof renderWithProviders>["user"]) {
  await user.type(screen.getByLabelText(/Artist's Presentation Name/i), "Juana Molina");
  await user.type(screen.getByLabelText(/Title of Release/i), "DOGA");
  await user.selectOptions(await screen.findByLabelText("Format"), "3");
}

describe("classic RotationReleaseInsert — rotationReleaseInsert.jsp", () => {
  beforeEach(() => {
    mockPush.mockClear();
    server.use(
      http.get(FORMATS, () =>
        HttpResponse.json([
          { id: 3, format_name: "CD" },
          { id: 4, format_name: "LP" },
        ]),
      ),
    );
  });

  it("renders the JSP's field order and labels for every Backend-supportable field", () => {
    renderWithProviders(<RotationReleaseInsert />);

    expect(screen.getByText(/Add a Release to the rotation database/i)).toBeInTheDocument();
    expect(screen.getByText(/Click here to input 'Various Artists'/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Artist's Presentation Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Title of Release/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Format")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Heavy" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Medium" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Light" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Singles" })).not.toBeChecked();
    expect(screen.getByLabelText("Record Label")).toBeInTheDocument();
    expect(screen.getByText(/self-released/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add this record" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset to default values" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Rotation Release List/i })).toHaveAttribute(
      "href",
      "/dashboard/rotation",
    );
  });

  // Format sits between Title of Release and Rotation in the JSP, and the
  // placeholder is its first option there too.
  it("puts the Format select where the JSP puts it, with the JSP's placeholder", async () => {
    renderWithProviders(<RotationReleaseInsert />);

    await screen.findByRole("option", { name: "CD" });
    const format = screen.getByLabelText("Format");
    const rows = Array.from(document.querySelectorAll("tr"));
    const rowOf = (el: Element) => rows.findIndex((row) => row.contains(el));
    expect(rowOf(screen.getByLabelText(/Title of Release/i))).toBeLessThan(rowOf(format));
    expect(rowOf(format)).toBeLessThan(rowOf(screen.getByRole("radio", { name: "Heavy" })));

    expect(within(format).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "-- Choose a format --",
      "CD",
      "LP",
    ]);
  });

  it("fills the presentation name via the Various Artists shortcut", async () => {
    const { user } = renderWithProviders(<RotationReleaseInsert />);
    await user.click(screen.getByText(/Click here to input 'Various Artists'/i));
    expect(screen.getByLabelText(/Artist's Presentation Name/i)).toHaveValue("Various Artists");
  });

  it("clears the record label via the self-released link", async () => {
    const { user } = renderWithProviders(<RotationReleaseInsert />);
    const labelField = screen.getByLabelText("Record Label");
    await user.type(labelField, "Sonamos");
    expect(labelField).toHaveValue("Sonamos");

    await user.click(screen.getByText(/self-released/i));
    expect(labelField).toHaveValue("");
  });

  // The live region has to be in the DOM before its content changes, or the
  // refusal is announced unreliably (or not at all).
  it("keeps an empty live region on screen before there is anything to refuse", () => {
    renderWithProviders(<RotationReleaseInsert />);
    expect(screen.getByRole("alert")).toHaveTextContent("");
  });

  it("refuses to submit with no presentation name", async () => {
    const { user } = renderWithProviders(<RotationReleaseInsert />);
    await user.type(screen.getByLabelText(/Title of Release/i), "DOGA");
    await user.click(screen.getByRole("button", { name: "Add this record" }));

    expect(await screen.findByText("Please enter a presentation name.")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("refuses to submit with no title", async () => {
    const { user } = renderWithProviders(<RotationReleaseInsert />);
    await user.type(screen.getByLabelText(/Artist's Presentation Name/i), "Juana Molina");
    await user.click(screen.getByRole("button", { name: "Add this record" }));

    expect(await screen.findByText("Please enter a title.")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("submits rotation_bin, artist_name, and album_title, omitting record_label when blank", async () => {
    let requestBody: unknown;
    server.use(
      http.post(BASE, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(
          { id: 9001, album_id: null, rotation_bin: "H", add_date: "2026-08-29", kill_date: null },
          { status: 201 },
        );
      }),
    );

    const { user } = renderWithProviders(<RotationReleaseInsert />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Add this record" }));

    // The JSP's own destination after an add is the record it just created.
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard/rotation/9001"));
    expect(requestBody).toEqual({
      rotation_bin: "H",
      artist_name: "Juana Molina",
      album_title: "DOGA",
      format_id: 3,
    });
  });

  it("includes record_label when the field is filled in", async () => {
    let requestBody: unknown;
    server.use(
      http.post(BASE, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(
          { id: 9001, album_id: null, rotation_bin: "M", add_date: "2026-08-29", kill_date: null },
          { status: 201 },
        );
      }),
    );

    const { user } = renderWithProviders(<RotationReleaseInsert />);
    await fillRequiredFields(user);
    await user.type(screen.getByLabelText("Record Label"), "Sonamos");
    await user.click(screen.getByRole("radio", { name: "Medium" }));
    await user.click(screen.getByRole("button", { name: "Add this record" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    expect(requestBody).toEqual({
      rotation_bin: "M",
      artist_name: "Juana Molina",
      album_title: "DOGA",
      format_id: 3,
      record_label: "Sonamos",
    });
  });

  it("renders the server's refusal message inline, matching the JSP's validationMessage div", async () => {
    server.use(
      http.post(BASE, () =>
        HttpResponse.json({ message: "Invalid Parameter: artist_name exceeds the 128-character limit" }, { status: 400 }),
      ),
    );

    const { user } = renderWithProviders(<RotationReleaseInsert />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Add this record" }));

    expect(
      await screen.findByText("Invalid Parameter: artist_name exceeds the 128-character limit"),
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("resets every field to its default on Reset", async () => {
    const { user } = renderWithProviders(<RotationReleaseInsert />);
    await user.type(screen.getByLabelText(/Artist's Presentation Name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/Title of Release/i), "DOGA");
    await user.click(screen.getByRole("radio", { name: "Light" }));

    await user.selectOptions(await screen.findByLabelText("Format"), "3");

    await user.click(screen.getByRole("button", { name: "Reset to default values" }));

    expect(screen.getByLabelText(/Artist's Presentation Name/i)).toHaveValue("");
    expect(screen.getByLabelText(/Title of Release/i)).toHaveValue("");
    expect(screen.getByRole("radio", { name: "Heavy" })).toBeChecked();
    expect(screen.getByLabelText("Format")).toHaveValue("");
  });

  it("refuses to submit with no format, in the JSP's own words", async () => {
    const { user } = renderWithProviders(<RotationReleaseInsert />);
    await user.type(screen.getByLabelText(/Artist's Presentation Name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/Title of Release/i), "DOGA");
    await user.click(screen.getByRole("button", { name: "Add this record" }));

    expect(await screen.findByText("Please select a format.")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  // Backend guards both pre-catalog FKs with `!= null`, so an explicit null
  // reads as absent rather than as "clear this". The three states are
  // distinct on the wire and the form must never send the middle one.
  describe("label_id and format_id, in all three states", () => {
    async function submitAndCapture(
      arrange: (user: ReturnType<typeof renderWithProviders>["user"]) => Promise<void>,
    ) {
      let requestBody: Record<string, unknown> | undefined;
      server.use(
        http.post(BASE, async ({ request }) => {
          requestBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            { id: 9001, album_id: null, rotation_bin: "H", add_date: "2026-08-29", kill_date: null },
            { status: 201 },
          );
        }),
      );

      const { user } = renderWithProviders(<RotationReleaseInsert />);
      await fillRequiredFields(user);
      await arrange(user);
      await user.click(screen.getByRole("button", { name: "Add this record" }));
      await waitFor(() => expect(requestBody).toBeDefined());
      return requestBody as Record<string, unknown>;
    }

    it("sends a value for label_id once the typed text names an existing label", async () => {
      const body = await submitAndCapture(async (user) => {
        await user.type(screen.getByLabelText("Record Label"), "Sonamos");
        await user.click(screen.getByRole("button", { name: "match an existing label" }));
      });

      expect(body.label_id).toBe(COMPANY_AUTOCOMPLETE_MATCH.id);
      expect(body.record_label).toBe(COMPANY_AUTOCOMPLETE_MATCH.label_name);
    });

    it("omits label_id entirely for a typed label that matched nothing, rather than sending null", async () => {
      const body = await submitAndCapture(async (user) => {
        await user.type(screen.getByLabelText("Record Label"), "Sonamos Discos");
      });

      expect("label_id" in body).toBe(false);
      expect(body.record_label).toBe("Sonamos Discos");
    });

    // Editing the text after a match un-names the label it matched. Carrying
    // the stale id would file the row under a label whose name is no longer
    // in the box.
    it("drops a matched label_id once the text is edited away from it", async () => {
      const body = await submitAndCapture(async (user) => {
        await user.type(screen.getByLabelText("Record Label"), "Sonamos");
        await user.click(screen.getByRole("button", { name: "match an existing label" }));
        await user.type(screen.getByLabelText("Record Label"), " Discos");
      });

      expect("label_id" in body).toBe(false);
    });

    it("never sends format_id as null — an unchosen format is refused instead", async () => {
      let posted = false;
      server.use(
        http.post(BASE, () => {
          posted = true;
          return HttpResponse.json({ id: 9001 }, { status: 201 });
        }),
      );

      const { user } = renderWithProviders(<RotationReleaseInsert />);
      await user.type(screen.getByLabelText(/Artist's Presentation Name/i), "Juana Molina");
      await user.type(screen.getByLabelText(/Title of Release/i), "DOGA");
      await user.click(screen.getByRole("button", { name: "Add this record" }));

      await screen.findByText("Please select a format.");
      expect(posted).toBe(false);
    });
  });
});
