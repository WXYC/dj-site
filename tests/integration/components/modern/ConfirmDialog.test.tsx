import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { createComponentHarness } from "@/tests/helpers";
import ConfirmDialog, {
  type ConfirmDialogProps,
} from "@/src/components/experiences/modern/ConfirmDialog";

const setup = createComponentHarness<ConfirmDialogProps>(ConfirmDialog, {
  open: true,
  onClose: vi.fn(),
  title: "Discard changes?",
  actions: <button>Confirm</button>,
  children: "Nothing has been saved yet.",
});

describe("ConfirmDialog", () => {
  it("renders nothing while closed", () => {
    setup({ open: false });

    expect(
      screen.queryByText("Nothing has been saved yet.")
    ).not.toBeInTheDocument();
  });

  it("renders title, content, and actions as an alertdialog", () => {
    setup();

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Discard changes?")).toBeInTheDocument();
    expect(screen.getByText("Nothing has been saved yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it("labels the dialog with its title via aria-labelledby", () => {
    setup();

    expect(
      screen.getByRole("alertdialog", { name: "Discard changes?" })
    ).toBeInTheDocument();
  });

  // Without a caller-supplied id the shell falls back to `useId()`, which must
  // still label the dialog — the fallback is what an unaware call site gets.
  it("labels the dialog when the caller supplies a stable titleId", () => {
    setup({ titleId: "discard-title" });

    expect(
      screen.getByRole("alertdialog", { name: "Discard changes?" })
    ).toBeInTheDocument();
    expect(screen.getByText("Discard changes?")).toHaveAttribute(
      "id",
      "discard-title"
    );
  });

  it("applies the given data-testid to the dialog", () => {
    setup({ testId: "my-confirm-dialog" });

    expect(screen.getByTestId("my-confirm-dialog")).toBeInTheDocument();
  });

  it("closes on Escape when not pending", async () => {
    const onClose = vi.fn();
    const { user } = setup({ onClose });

    await user.keyboard("{Escape}");

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("suppresses Escape dismissal while pending", async () => {
    const onClose = vi.fn();
    const { user } = setup({ onClose, pending: true });

    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
