import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTestAlbum, createTestArtist } from "@/tests/helpers";
import { renderWithProviders } from "@/tests/helpers/render";

const mockGetInformationQuery = vi.fn();
const mockUpdateAlbum = vi.fn();
const mockMarkMissing = vi.fn();
const mockMarkFound = vi.fn();

vi.mock("@/lib/features/catalog/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/catalog/api")>();
  return {
    ...actual,
    useGetInformationQuery: (...args: unknown[]) => mockGetInformationQuery(...args),
    useGetFormatsQuery: () => ({ data: [{ id: 1, format_name: "cd" }, { id: 2, format_name: "lp" }] }),
    useUpdateAlbumMutation: () => [mockUpdateAlbum, { isLoading: false }],
    useMarkMissingMutation: () => [mockMarkMissing, { isLoading: false }],
    useMarkFoundMutation: () => [mockMarkFound, { isLoading: false }],
  };
});

import ReleaseCard from "@/src/components/experiences/classic/catalog/ReleaseCard";

const album = (overrides = {}) =>
  createTestAlbum({
    id: 53375,
    title: "Tri Repetae",
    entry: 1,
    format: "cd",
    format_id: 1,
    label: "Warp",
    artist: createTestArtist({
      name: "Autechre",
      lettercode: "AU",
      numbercode: 3,
      genre: "Electronic",
    }),
    ...overrides,
  });

describe("Classic ReleaseCard", () => {
  it("reproduces the JSP's heading and code row", () => {
    mockGetInformationQuery.mockReturnValue({ data: album(), isLoading: false, isError: false });

    renderWithProviders(<ReleaseCard albumId={53375} />);

    expect(screen.getByText("View/Modify a Library Release")).toBeDefined();
    expect(screen.getByTestId("release-library-code").textContent).toBe("Electronic AU 3/1");
    expect(screen.getByTestId("release-call-number").textContent).toBe("1");
  });

  it("composes a compilation's code as a V/A bucket, not a 0 artist number", () => {
    mockGetInformationQuery.mockReturnValue({
      data: album({
        album_artist: "Various",
        artist: createTestArtist({
          name: "Various Artists",
          lettercode: "V/A",
          numbercode: 0,
          genre: "Electronic",
        }),
      }),
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<ReleaseCard albumId={9001} />);

    // Not "Electronic V/A 0/1" — the shelf has no such call number.
    expect(screen.getByTestId("release-library-code").textContent).toBe("Electronic V/A-1");
  });

  it("submits the fields Backend actually accepts", async () => {
    const user = userEvent.setup();
    mockUpdateAlbum.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    mockGetInformationQuery.mockReturnValue({ data: album(), isLoading: false, isError: false });

    renderWithProviders(<ReleaseCard albumId={53375} />);

    const title = screen.getByLabelText("Title of Release");
    await user.clear(title);
    await user.type(title, "Tri Repetae++");
    await user.click(screen.getByDisplayValue("Modify this Library Release"));

    expect(mockUpdateAlbum).toHaveBeenCalledWith({
      albumId: 53375,
      body: expect.objectContaining({ album_title: "Tri Repetae++" }),
    });
  });

  it("refuses an empty title rather than sending it", async () => {
    const user = userEvent.setup();
    mockUpdateAlbum.mockClear();
    mockGetInformationQuery.mockReturnValue({ data: album(), isLoading: false, isError: false });

    renderWithProviders(<ReleaseCard albumId={53375} />);

    await user.clear(screen.getByLabelText("Title of Release"));
    await user.click(screen.getByDisplayValue("Modify this Library Release"));

    expect(mockUpdateAlbum).not.toHaveBeenCalled();
    expect(screen.getByTestId("release-message").textContent).toContain("enter a title");
  });

  it("offers Mark as Missing for a shelved release, and Mark as Found for a lost one", () => {
    mockGetInformationQuery.mockReturnValue({ data: album(), isLoading: false, isError: false });
    const { unmount } = renderWithProviders(<ReleaseCard albumId={53375} />);
    expect(screen.getByTestId("release-library-status").textContent).toContain("In Library");
    expect(screen.getByRole("button", { name: "Mark as Missing" })).toBeDefined();
    unmount();

    mockGetInformationQuery.mockReturnValue({
      data: album({ date_lost: "2026-01-15T12:00:00.000Z" }),
      isLoading: false,
      isError: false,
    });
    renderWithProviders(<ReleaseCard albumId={53375} />);
    expect(screen.getByTestId("release-library-status").textContent).toContain("Missing since");
    expect(screen.getByRole("button", { name: "Mark as Found" })).toBeDefined();
  });

  it("surfaces a load failure rather than rendering an empty card", () => {
    mockGetInformationQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    renderWithProviders(<ReleaseCard albumId={1} />);

    expect(screen.getByTestId("release-card-error")).toBeDefined();
  });
});
