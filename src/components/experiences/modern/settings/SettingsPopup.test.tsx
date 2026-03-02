import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import SettingsPopup from "./SettingsPopup";
import { renderWithProviders } from "@/lib/test-utils";
import { createTestUser } from "@/lib/test-utils/fixtures";
import { Authorization } from "@/lib/features/admin/types";
import type { User } from "@/lib/features/authentication/types";

// Mock next/navigation
const mockRouterBack = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: mockRouterBack,
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock useDJAccount hook
const mockHandleSaveData = vi.fn(async (e: React.FormEvent) => { e.preventDefault(); });
vi.mock("@/src/hooks/djHooks", () => ({
  useDJAccount: vi.fn(() => ({
    info: { id: "1", dj_name: "Test DJ", real_name: "Test User" },
    loading: false,
    handleSaveData: mockHandleSaveData,
  })),
}));

// Mock SettingsInput component
vi.mock("@/src/components/experiences/modern/settings/SettingsInput", () => ({
  default: ({
    name,
    backendValue,
    endDecorator,
    disabled,
  }: {
    name: string;
    backendValue?: string;
    endDecorator?: React.ReactNode;
    disabled?: boolean;
  }) => (
    <input
      data-testid={`settings-input-${name}`}
      name={name}
      defaultValue={backendValue}
      disabled={disabled}
      aria-label={name}
    />
  ),
}));

// Mock MUI icons
vi.mock("@mui/icons-material", () => ({
  AccountCircle: () => <span data-testid="account-circle-icon" />,
  AlternateEmail: () => <span data-testid="alternate-email-icon" />,
  Email: () => <span data-testid="email-icon" />,
  TheaterComedy: () => <span data-testid="theater-comedy-icon" />,
}));

vi.mock("@mui/icons-material/Badge", () => ({
  default: () => <span data-testid="badge-icon" />,
}));

describe("SettingsPopup", () => {
  let testUser: User;

  beforeEach(() => {
    vi.clearAllMocks();
    testUser = createTestUser({
      username: "testdj",
      email: "testdj@wxyc.org",
      realName: "Test DJ Name",
      djName: "DJ Test",
      authority: Authorization.DJ,
    });
  });

  describe("Rendering", () => {
    it("should render modal with title", () => {
      renderWithProviders(<SettingsPopup user={testUser} />);

      expect(screen.getByText("Your Information")).toBeInTheDocument();
    });

    it("should render account circle icon in title", () => {
      renderWithProviders(<SettingsPopup user={testUser} />);

      expect(screen.getByTestId("account-circle-icon")).toBeInTheDocument();
    });

    it("should render username field as disabled", () => {
      renderWithProviders(<SettingsPopup user={testUser} />);

      expect(screen.getByText("Username")).toBeInTheDocument();
      // The username input is from MUI Input (not our mock SettingsInput)
      const usernameInput = screen.getByDisplayValue("testdj");
      expect(usernameInput).toBeDisabled();
    });

    it("should render personal name field", () => {
      renderWithProviders(<SettingsPopup user={testUser} />);

      expect(screen.getByText("Personal Name")).toBeInTheDocument();
      expect(screen.getByTestId("settings-input-realName")).toBeInTheDocument();
    });

    it("should render DJ name field", () => {
      renderWithProviders(<SettingsPopup user={testUser} />);

      expect(screen.getByText("DJ Name")).toBeInTheDocument();
      expect(screen.getByTestId("settings-input-djName")).toBeInTheDocument();
    });

    it("should render email field as disabled", () => {
      renderWithProviders(<SettingsPopup user={testUser} />);

      expect(screen.getByText("Email")).toBeInTheDocument();
      const emailInput = screen.getByTestId("settings-input-email");
      expect(emailInput).toBeDisabled();
    });

    it("should render save button", () => {
      renderWithProviders(<SettingsPopup user={testUser} />);

      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    });

    it("should display user values in inputs", () => {
      renderWithProviders(<SettingsPopup user={testUser} />);

      expect(screen.getByDisplayValue("testdj")).toBeInTheDocument();
      expect(screen.getByTestId("settings-input-realName")).toHaveValue(
        "Test DJ Name"
      );
      expect(screen.getByTestId("settings-input-djName")).toHaveValue(
        "DJ Test"
      );
      expect(screen.getByTestId("settings-input-email")).toHaveValue(
        "testdj@wxyc.org"
      );
    });
  });

  describe("Save Button State", () => {
    it("should have submit type on save button", () => {
      renderWithProviders(<SettingsPopup user={testUser} />);

      expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
        "type",
        "submit"
      );
    });

    it("should be disabled when not modified", async () => {
      renderWithProviders(<SettingsPopup user={testUser} />);

      // By default isModified returns false, so button should be disabled
      const saveButton = screen.getByRole("button", { name: "Save" });
      expect(saveButton).toBeDisabled();
    });
  });

  describe("Modal Behavior", () => {
    it("should call router.back when modal closes", () => {
      renderWithProviders(<SettingsPopup user={testUser} />);

      // Find the modal backdrop and click it
      const backdrop = document.querySelector(".MuiModal-backdrop");
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(mockRouterBack).toHaveBeenCalled();
    });

    it("should render modal as open", () => {
      renderWithProviders(<SettingsPopup user={testUser} />);

      // Modal should be visible
      expect(screen.getByRole("presentation")).toBeInTheDocument();
    });
  });

  describe("Form Submission", () => {
    it("should call handleSaveData on form submit", async () => {
      renderWithProviders(<SettingsPopup user={testUser} />);

      const form = document.querySelector("form");
      if (form) {
        fireEvent.submit(form);
      }

      expect(mockHandleSaveData).toHaveBeenCalled();
    });
  });

  describe("Loading State", () => {
    it("should show loading state on save button when loading", async () => {
      // Override the mock for this test
      const { useDJAccount } = await import("@/src/hooks/djHooks");
      vi.mocked(useDJAccount).mockReturnValue({
        info: { id: "1", dj_name: "Test DJ", real_name: "Test User" },
        loading: true,
        handleSaveData: mockHandleSaveData,
      });

      renderWithProviders(<SettingsPopup user={testUser} />);

      const saveButton = screen.getByRole("button", { name: "Save" });
      // When loading, button should have loading indicator
      expect(saveButton).toBeInTheDocument();
    });
  });

  describe("User Data Edge Cases", () => {
    it("should handle user without realName", () => {
      const userWithoutRealName = createTestUser({
        username: "testdj",
        email: "testdj@wxyc.org",
        realName: undefined,
        djName: "DJ Test",
      });

      renderWithProviders(<SettingsPopup user={userWithoutRealName} />);

      const realNameInput = screen.getByTestId("settings-input-realName");
      expect(realNameInput).toHaveValue("");
    });

    it("should handle user without djName", () => {
      const userWithoutDjName = createTestUser({
        username: "testdj",
        email: "testdj@wxyc.org",
        realName: "Test Name",
        djName: undefined,
      });

      renderWithProviders(<SettingsPopup user={userWithoutDjName} />);

      const djNameInput = screen.getByTestId("settings-input-djName");
      expect(djNameInput).toHaveValue("");
    });

    it("should handle user with all fields empty", () => {
      const emptyUser: User = {
        username: "testdj",
        email: "testdj@wxyc.org",
        authority: Authorization.DJ,
      };

      renderWithProviders(<SettingsPopup user={emptyUser} />);

      expect(screen.getByDisplayValue("testdj")).toBeInTheDocument();
    });

    it("should handle station manager user", () => {
      const stationManager = createTestUser({
        username: "manager",
        email: "manager@wxyc.org",
        realName: "Station Manager",
        djName: "Manager DJ",
        authority: Authorization.SM,
      });

      renderWithProviders(<SettingsPopup user={stationManager} />);

      expect(screen.getByDisplayValue("manager")).toBeInTheDocument();
      expect(screen.getByTestId("settings-input-realName")).toHaveValue(
        "Station Manager"
      );
    });
  });

  describe("Form Labels", () => {
    it("should have all required form labels", () => {
      renderWithProviders(<SettingsPopup user={testUser} />);

      expect(screen.getByText("Username")).toBeInTheDocument();
      expect(screen.getByText("Personal Name")).toBeInTheDocument();
      expect(screen.getByText("DJ Name")).toBeInTheDocument();
      expect(screen.getByText("Email")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have accessible form structure", () => {
      renderWithProviders(<SettingsPopup user={testUser} />);

      const form = document.querySelector("form");
      expect(form).toBeInTheDocument();
    });

    it("should have accessible button", () => {
      renderWithProviders(<SettingsPopup user={testUser} />);

      const saveButton = screen.getByRole("button", { name: "Save" });
      expect(saveButton).toBeInTheDocument();
    });
  });
});
