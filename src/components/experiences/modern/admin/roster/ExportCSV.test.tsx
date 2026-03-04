import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import ExportDJsButton from "./ExportCSV";
import { adminSlice } from "@/lib/features/admin/frontend";
import { Authorization } from "@/lib/features/admin/types";

// Mock adminHooks
vi.mock("@/src/hooks/adminHooks", () => ({
  useAccountListResults: () => ({
    data: [
      {
        id: "1",
        realName: "Test User",
        userName: "testuser",
        djName: "DJ Test",
        email: "test@example.com",
        authorization: Authorization.DJ,
      },
      {
        id: "2",
        realName: "Admin User",
        userName: "adminuser",
        djName: "DJ Admin",
        email: "admin@example.com",
        authorization: Authorization.SM,
      },
    ],
    isLoading: false,
  }),
}));

function createTestStore(searchString = "") {
  return configureStore({
    reducer: {
      admin: adminSlice.reducer,
    },
    preloadedState: {
      admin: {
        ...adminSlice.getInitialState(),
        searchString,
      },
    },
  });
}

function renderWithProvider(ui: React.ReactElement, searchString = "") {
  const store = createTestStore(searchString);
  return {
    ...render(<Provider store={store}>{ui}</Provider>),
    store,
  };
}

describe("ExportDJsButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render export button", () => {
    renderWithProvider(<ExportDJsButton />);
    expect(screen.getByRole("button", { name: /export roster as csv/i })).toBeInTheDocument();
  });

  it("should have success color variant", () => {
    renderWithProvider(<ExportDJsButton />);
    const button = screen.getByRole("button", { name: /export roster as csv/i });
    expect(button).toHaveClass("MuiButton-colorSuccess");
  });

  it("should be outlined variant", () => {
    renderWithProvider(<ExportDJsButton />);
    const button = screen.getByRole("button", { name: /export roster as csv/i });
    expect(button).toHaveClass("MuiButton-variantOutlined");
  });

  it("should trigger download on click", () => {
    const { container } = renderWithProvider(<ExportDJsButton />);

    // Mock link click after render
    const mockLink = {
      click: vi.fn(),
      setAttribute: vi.fn(),
    };
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") {
        return mockLink as any;
      }
      return originalCreateElement(tag);
    });
    vi.spyOn(document.body, "appendChild").mockImplementation(() => mockLink as any);
    vi.spyOn(document.body, "removeChild").mockImplementation(() => mockLink as any);

    const button = screen.getByRole("button", { name: /export roster as csv/i });
    fireEvent.click(button);

    expect(mockLink.click).toHaveBeenCalled();
    expect(mockLink.setAttribute).toHaveBeenCalledWith("download", expect.stringContaining("wxyc-roster-"));

    createElementSpy.mockRestore();
  });
});
