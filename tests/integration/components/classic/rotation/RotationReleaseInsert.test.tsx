import { describe, it, expect, beforeEach, vi } from "vitest";
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

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// CompanyAutocomplete has its own dedicated test coverage; here it is
// replaced with a bare labelled input so this form's own submit/validation
// logic is under test, not the label search widget.
vi.mock("@/src/components/experiences/classic/rotation/CompanyAutocomplete", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <input
      aria-label="Record Label"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import RotationReleaseInsert from "@/src/components/experiences/classic/rotation/RotationReleaseInsert";

const BASE = `${TEST_BACKEND_URL}/library/rotation`;

describe("classic RotationReleaseInsert — rotationReleaseInsert.jsp", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders the JSP's field order and labels for every Backend-supportable field", () => {
    renderWithProviders(<RotationReleaseInsert />);

    expect(screen.getByText(/Add a Release to the rotation database/i)).toBeInTheDocument();
    expect(screen.getByText(/Click here to input 'Various Artists'/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Artist's Presentation Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Title of Release/i)).toBeInTheDocument();
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
    await user.type(screen.getByLabelText(/Artist's Presentation Name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/Title of Release/i), "DOGA");
    await user.click(screen.getByRole("button", { name: "Add this record" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard/rotation"));
    expect(requestBody).toEqual({
      rotation_bin: "H",
      artist_name: "Juana Molina",
      album_title: "DOGA",
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
    await user.type(screen.getByLabelText(/Artist's Presentation Name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/Title of Release/i), "DOGA");
    await user.type(screen.getByLabelText("Record Label"), "Sonamos");
    await user.click(screen.getByRole("radio", { name: "Medium" }));
    await user.click(screen.getByRole("button", { name: "Add this record" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    expect(requestBody).toEqual({
      rotation_bin: "M",
      artist_name: "Juana Molina",
      album_title: "DOGA",
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
    await user.type(screen.getByLabelText(/Artist's Presentation Name/i), "Juana Molina");
    await user.type(screen.getByLabelText(/Title of Release/i), "DOGA");
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

    await user.click(screen.getByRole("button", { name: "Reset to default values" }));

    expect(screen.getByLabelText(/Artist's Presentation Name/i)).toHaveValue("");
    expect(screen.getByLabelText(/Title of Release/i)).toHaveValue("");
    expect(screen.getByRole("radio", { name: "Heavy" })).toBeChecked();
  });
});
