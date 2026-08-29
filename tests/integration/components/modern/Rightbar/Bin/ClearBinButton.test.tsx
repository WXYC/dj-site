import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";
import ClearBinButton from "@/src/components/experiences/modern/Rightbar/Bin/ClearBinButton";

const clearBin = vi.fn().mockResolvedValue(undefined);
// `loading` is the aggregate (a clear in flight OR the registry still
// resolving); `clearing` is only the former. They are separate here because
// the dialog's dismissal guard keys off the latter — see the Escape case below.
let binState = { clearBin, loading: false, clearing: false };

vi.mock("@/src/hooks/binHooks", () => ({
  useClearBin: () => binState,
}));

describe("ClearBinButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    binState = { clearBin, loading: false, clearing: false };
  });

  it("does not show the confirmation until the button is clicked", () => {
    renderWithProviders(<ClearBinButton count={3} />);

    expect(
      screen.queryByText(/from your Mail Bin\?/)
    ).not.toBeInTheDocument();
  });

  it("opens a confirmation with correctly spaced, pluralized copy", async () => {
    const { user } = renderWithProviders(<ClearBinButton count={3} />);

    await user.click(screen.getByRole("button", { name: "Clear Mail Bin" }));

    // The spacing fix: "albums from" must not be jammed together.
    expect(
      screen.getByText(
        "Clear all 3 albums from your Mail Bin? This can't be undone."
      )
    ).toBeInTheDocument();
  });

  it("uses the singular noun for a single album", async () => {
    const { user } = renderWithProviders(<ClearBinButton count={1} />);

    await user.click(screen.getByRole("button", { name: "Clear Mail Bin" }));

    expect(
      screen.getByText(
        "Clear all 1 album from your Mail Bin? This can't be undone."
      )
    ).toBeInTheDocument();
  });

  it("clears the bin and closes on confirm", async () => {
    const { user } = renderWithProviders(<ClearBinButton count={2} />);

    await user.click(screen.getByRole("button", { name: "Clear Mail Bin" }));
    await user.click(screen.getByRole("button", { name: "Clear bin" }));

    expect(clearBin).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        screen.queryByText(/from your Mail Bin\?/)
      ).not.toBeInTheDocument()
    );
  });

  // Regression guard: `loading` also goes true while the registry re-resolves
  // the DJ's org role — a session refresh mid-dialog, with nothing about the
  // bin on the wire. In that window Cancel is disabled and Clear bin is
  // disabled, so Escape is the only exit left; keying the dismissal guard to
  // the aggregate would shut all three at once and strand the DJ until reload.
  it("stays dismissable while the registry is loading but no clear is in flight", async () => {
    binState = { clearBin, loading: true, clearing: false };
    const { user } = renderWithProviders(<ClearBinButton count={2} />);

    await user.click(screen.getByRole("button", { name: "Clear Mail Bin" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(
        screen.queryByText(/from your Mail Bin\?/)
      ).not.toBeInTheDocument()
    );
    expect(clearBin).not.toHaveBeenCalled();
  });

  it("refuses dismissal while a clear is actually in flight", async () => {
    binState = { clearBin, loading: true, clearing: true };
    const { user } = renderWithProviders(<ClearBinButton count={2} />);

    await user.click(screen.getByRole("button", { name: "Clear Mail Bin" }));
    await user.keyboard("{Escape}");

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  // The association this component now delegates to ConfirmDialog's useId()
  // wiring. Every other query here is by text or role-name of a button, all of
  // which stay green if aria-labelledby silently points at nothing.
  it("labels the confirmation with its title", async () => {
    const { user } = renderWithProviders(<ClearBinButton count={2} />);

    await user.click(screen.getByRole("button", { name: "Clear Mail Bin" }));

    expect(
      screen.getByRole("alertdialog", { name: "Clear Mail Bin" })
    ).toBeInTheDocument();
  });

  it("closes without clearing on cancel", async () => {
    const { user } = renderWithProviders(<ClearBinButton count={2} />);

    await user.click(screen.getByRole("button", { name: "Clear Mail Bin" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(clearBin).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.queryByText(/from your Mail Bin\?/)
      ).not.toBeInTheDocument()
    );
  });
});
