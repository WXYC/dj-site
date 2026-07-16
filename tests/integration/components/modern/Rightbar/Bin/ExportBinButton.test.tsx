import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";
import { createTestAlbum, createTestArtist } from "@/tests/fixtures/fixtures";
import { toast } from "sonner";
import ExportBinButton from "@/src/components/experiences/modern/Rightbar/Bin/ExportBinButton";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const entries = [
  createTestAlbum({
    title: "DOGA",
    artist: createTestArtist({ name: "Juana Molina" }),
    label: "Sonamos",
    format: "Vinyl",
  }),
];

// Snapshot the descriptors so each test can install its own share/clipboard
// stubs and we can fully restore jsdom's defaults afterward.
const originalShare = Object.getOwnPropertyDescriptor(navigator, "share");
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

function setNavigator(prop: "share" | "clipboard", value: unknown) {
  Object.defineProperty(navigator, prop, { value, configurable: true });
}

function restore(prop: "share" | "clipboard", desc?: PropertyDescriptor) {
  if (desc) Object.defineProperty(navigator, prop, desc);
  else delete (navigator as unknown as Record<string, unknown>)[prop];
}

beforeEach(() => {
  vi.clearAllMocks();
  // Start each test with neither capability; opt in per case. Shadow with
  // `undefined` rather than deleting — some jsdom builds expose `share` on the
  // Navigator prototype, which a `delete` of the own property would re-reveal.
  setNavigator("share", undefined);
  setNavigator("clipboard", undefined);
  vi.stubGlobal(
    "ClipboardItem",
    class {
      items: Record<string, Blob>;
      constructor(items: Record<string, Blob>) {
        this.items = items;
      }
    },
  );
});

afterEach(() => {
  restore("share", originalShare);
  restore("clipboard", originalClipboard);
  vi.unstubAllGlobals();
});

describe("ExportBinButton", () => {
  it("renders an export icon button", () => {
    renderWithProviders(<ExportBinButton entries={entries} />);
    expect(
      screen.getByRole("button", { name: "Export Mail Bin" }),
    ).toBeInTheDocument();
  });

  it("opens the native share sheet when one is available, without copying", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const write = vi.fn().mockResolvedValue(undefined);

    const { user } = renderWithProviders(<ExportBinButton entries={entries} />);
    // Install after render: userEvent.setup() defines its own navigator.clipboard.
    setNavigator("share", share);
    setNavigator("clipboard", { write });
    await user.click(screen.getByRole("button", { name: "Export Mail Bin" }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const arg = share.mock.calls[0][0];
    expect(arg.title).toBe("WXYC Mail Bin");
    expect(arg.text).toContain("DOGA — Juana Molina (Sonamos)");
    // Sharing is its own confirmation — no clipboard write, no toast.
    expect(write).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("does nothing when the user dismisses the share sheet", async () => {
    const abort = new DOMException("dismissed", "AbortError");
    const share = vi.fn().mockRejectedValue(abort);
    const write = vi.fn().mockResolvedValue(undefined);

    const { user } = renderWithProviders(<ExportBinButton entries={entries} />);
    setNavigator("share", share);
    setNavigator("clipboard", { write });
    await user.click(screen.getByRole("button", { name: "Export Mail Bin" }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(write).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("copies a rich table to the clipboard and toasts when there is no share sheet", async () => {
    const write = vi.fn().mockResolvedValue(undefined);

    const { user } = renderWithProviders(<ExportBinButton entries={entries} />);
    setNavigator("clipboard", { write });
    await user.click(screen.getByRole("button", { name: "Export Mail Bin" }));

    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    const item = write.mock.calls[0][0][0] as { items: Record<string, Blob> };
    expect(Object.keys(item.items).sort()).toEqual(["text/html", "text/plain"]);
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Mail Bin copied — paste it into an email or a doc",
      ),
    );
  });

  it("falls back to writeText when rich clipboard write is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    const { user } = renderWithProviders(<ExportBinButton entries={entries} />);
    setNavigator("clipboard", { writeText });
    await user.click(screen.getByRole("button", { name: "Export Mail Bin" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain("DOGA\tJuana Molina");
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
  });

  it("toasts an error when copying fails", async () => {
    const write = vi.fn().mockRejectedValue(new Error("denied"));

    const { user } = renderWithProviders(<ExportBinButton entries={entries} />);
    setNavigator("clipboard", { write });
    await user.click(screen.getByRole("button", { name: "Export Mail Bin" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't copy the Mail Bin"),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});
