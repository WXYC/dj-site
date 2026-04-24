import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render";
import ImportCSVModal from "./ImportCSVModal";

// Mock the auth client
vi.mock("@/lib/features/authentication/client", () => ({
  authBaseURL: "http://localhost:8082/auth",
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock shared validation
vi.mock("@wxyc/shared/validation", () => ({
  isValidEmail: (email: string) => {
    if (typeof email !== "string") return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },
}));

const validCSV = [
  "Name,Username,DJ Name,Email",
  "Juana Molina,jmolina,DJ Juana,juana@wxyc.org",
  "Cat Power,cpower,DJ Cat,cat@wxyc.org",
].join("\n");

const csvWithErrors = [
  "Name,Username,DJ Name,Email",
  "Juana Molina,jmolina,DJ Juana,juana@wxyc.org",
  ",,DJ Bad,not-an-email",
].join("\n");

function createCSVFile(content: string, name = "roster.csv"): File {
  return new File([content], name, { type: "text/csv" });
}

describe("ImportCSVModal", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onComplete: vi.fn(),
    organizationSlug: "wxyc",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD", "temppass123");
    global.fetch = vi.fn();
  });

  describe("rendering", () => {
    it("should render the modal when open", () => {
      renderWithProviders(<ImportCSVModal {...defaultProps} />);

      expect(screen.getByText("Import DJs from CSV")).toBeInTheDocument();
    });

    it("should not render when closed", () => {
      renderWithProviders(<ImportCSVModal {...defaultProps} open={false} />);

      expect(screen.queryByText("Import DJs from CSV")).not.toBeInTheDocument();
    });

    it("should show file input in upload state", () => {
      renderWithProviders(<ImportCSVModal {...defaultProps} />);

      expect(screen.getByText(/drop a CSV file|click to browse/i)).toBeInTheDocument();
    });

    it("should show download template link", () => {
      renderWithProviders(<ImportCSVModal {...defaultProps} />);

      expect(screen.getByText(/download template/i)).toBeInTheDocument();
    });
  });

  describe("file upload", () => {
    it("should transition to preview state after valid file upload", async () => {
      const { user } = renderWithProviders(<ImportCSVModal {...defaultProps} />);
      const fileInput = screen.getByTestId("csv-file-input");

      await user.upload(fileInput, createCSVFile(validCSV));

      await waitFor(() => {
        expect(screen.getByText(/Found 2 accounts/)).toBeInTheDocument();
      });
    });

    it("should show parsed rows in preview table", async () => {
      const { user } = renderWithProviders(<ImportCSVModal {...defaultProps} />);
      const fileInput = screen.getByTestId("csv-file-input");

      await user.upload(fileInput, createCSVFile(validCSV));

      await waitFor(() => {
        expect(screen.getByText("Juana Molina")).toBeInTheDocument();
        expect(screen.getByText("Cat Power")).toBeInTheDocument();
      });
    });
  });

  describe("preview state", () => {
    async function renderWithPreview(csv = validCSV) {
      const result = renderWithProviders(<ImportCSVModal {...defaultProps} />);
      const fileInput = screen.getByTestId("csv-file-input");

      await result.user.upload(fileInput, createCSVFile(csv));
      await waitFor(() => {
        expect(screen.getByText(/Found \d+ account/)).toBeInTheDocument();
      });

      return result;
    }

    it("should show validation errors inline", async () => {
      await renderWithPreview(csvWithErrors);

      await waitFor(() => {
        expect(screen.getByText(/1 with errors/)).toBeInTheDocument();
      });
    });

    it("should show role selector defaulting to DJ", async () => {
      await renderWithPreview();

      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("should show create button with valid row count", async () => {
      await renderWithPreview();

      expect(screen.getByRole("button", { name: /Create 2 Accounts/ })).toBeInTheDocument();
    });

    it("should exclude invalid rows from create button count", async () => {
      await renderWithPreview(csvWithErrors);

      expect(screen.getByRole("button", { name: /Create 1 Account/ })).toBeInTheDocument();
    });

    it("should disable create button when all rows have errors", async () => {
      const allBadCSV = "Name,DJ Name,Email\n,,\n,,";
      await renderWithPreview(allBadCSV);

      const button = screen.getByRole("button", { name: /Create 0 Accounts/ });
      expect(button).toBeDisabled();
    });

    it("should call onClose when Cancel is clicked", async () => {
      const onClose = vi.fn();
      const result = renderWithProviders(
        <ImportCSVModal {...defaultProps} onClose={onClose} />
      );
      const fileInput = screen.getByTestId("csv-file-input");
      await result.user.upload(fileInput, createCSVFile(validCSV));

      await waitFor(() => {
        expect(screen.getByText(/Found 2 accounts/)).toBeInTheDocument();
      });

      await result.user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("import and results", () => {
    async function renderAndStartImport(csv = validCSV) {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ id: "new-user-id" }),
      });

      const result = renderWithProviders(<ImportCSVModal {...defaultProps} />);
      const fileInput = screen.getByTestId("csv-file-input");
      await result.user.upload(fileInput, createCSVFile(csv));

      await waitFor(() => {
        expect(screen.getByText(/Found \d+ account/)).toBeInTheDocument();
      });

      await result.user.click(screen.getByRole("button", { name: /Create \d+ Account/ }));

      return result;
    }

    it("should call provision-user for each valid row", async () => {
      await renderAndStartImport();

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:8082/auth/admin/provision-user",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: expect.stringContaining("juana@wxyc.org"),
        }),
      );
    });

    it("should send organizationSlug from prop in the request body", async () => {
      await renderAndStartImport();

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      const body = JSON.parse(
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
      );
      expect(body.organizationSlug).toBe("wxyc");
    });

    it("should show results summary after import completes", async () => {
      await renderAndStartImport();

      await waitFor(() => {
        expect(screen.getByText(/Created 2 of 2 accounts/)).toBeInTheDocument();
      });
    });

    it("should show Done button in results state", async () => {
      await renderAndStartImport();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
      });
    });

    it("should call onComplete when Done is clicked", async () => {
      const onComplete = vi.fn();
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ id: "new-user-id" }),
      });

      const { user } = renderWithProviders(
        <ImportCSVModal {...defaultProps} onComplete={onComplete} />
      );
      const fileInput = screen.getByTestId("csv-file-input");
      await user.upload(fileInput, createCSVFile(validCSV));

      await waitFor(() => {
        expect(screen.getByText(/Found 2 accounts/)).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /Create 2 Accounts/ }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Done" }));
      expect(onComplete).toHaveBeenCalled();
    });

    it("should handle API failures per row and show in results", async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
          json: async () => ({ message: "Email already exists" }),
        });

      const { user } = renderWithProviders(<ImportCSVModal {...defaultProps} />);
      const fileInput = screen.getByTestId("csv-file-input");
      await user.upload(fileInput, createCSVFile(validCSV));

      await waitFor(() => {
        expect(screen.getByText(/Found 2 accounts/)).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /Create 2 Accounts/ }));

      await waitFor(() => {
        expect(screen.getByText(/Created 1 of 2 accounts/)).toBeInTheDocument();
      });

      expect(screen.getByText(/Email already exists/)).toBeInTheDocument();
    });

    it("should skip rows with validation errors during import", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const { user } = renderWithProviders(<ImportCSVModal {...defaultProps} />);
      const fileInput = screen.getByTestId("csv-file-input");
      await user.upload(fileInput, createCSVFile(csvWithErrors));

      await waitFor(() => {
        expect(screen.getByText(/Found 2 accounts/)).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /Create 1 Account/ }));

      await waitFor(() => {
        expect(screen.getByText(/Created 1 of 1/)).toBeInTheDocument();
      });

      // Only one valid row should have been sent
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
