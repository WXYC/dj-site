import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";
import ConfirmDialog from "@/src/components/experiences/modern/ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders nothing while closed", () => {
    renderWithProviders(
      <ConfirmDialog
        open={false}
        onClose={vi.fn()}
        title="Title"
        actions={<button>Confirm</button>}
      >
        Content
      </ConfirmDialog>,
    );

    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });

  it("renders title, content, and actions as an alertdialog", () => {
    renderWithProviders(
      <ConfirmDialog
        open
        onClose={vi.fn()}
        title="Discard changes?"
        actions={<button>Discard</button>}
      >
        Nothing has been saved yet.
      </ConfirmDialog>,
    );

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Discard changes?")).toBeInTheDocument();
    expect(screen.getByText("Nothing has been saved yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discard" })).toBeInTheDocument();
  });

  it("labels the dialog with its title via aria-labelledby", () => {
    renderWithProviders(
      <ConfirmDialog
        open
        onClose={vi.fn()}
        title="Clear Mail Bin"
        actions={<button>Confirm</button>}
      >
        Content
      </ConfirmDialog>,
    );

    expect(
      screen.getByRole("alertdialog", { name: "Clear Mail Bin" }),
    ).toBeInTheDocument();
  });

  it("applies the given data-testid to the dialog", () => {
    renderWithProviders(
      <ConfirmDialog
        open
        onClose={vi.fn()}
        title="Title"
        testId="my-confirm-dialog"
        actions={<button>Confirm</button>}
      >
        Content
      </ConfirmDialog>,
    );

    expect(screen.getByTestId("my-confirm-dialog")).toBeInTheDocument();
  });

  it("closes on Escape when not pending", async () => {
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <ConfirmDialog open onClose={onClose} title="Title" actions={<button>Confirm</button>}>
        Content
      </ConfirmDialog>,
    );

    await user.keyboard("{Escape}");

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("suppresses Escape dismissal while pending", async () => {
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <ConfirmDialog
        open
        onClose={onClose}
        pending
        title="Title"
        actions={<button>Confirm</button>}
      >
        Content
      </ConfirmDialog>,
    );

    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
