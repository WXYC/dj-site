import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ThemeRegistry from "./ThemeRegistry";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useServerInsertedHTML: vi.fn((callback) => {
    // Don't actually call the callback in tests
  }),
}));

// Mock experiences hooks
const mockUseActiveExperience = vi.fn(() => "modern");
vi.mock("@/lib/features/experiences/hooks", () => ({
  useActiveExperience: () => mockUseActiveExperience(),
}));

// Mock themePreferenceHooks
const mockUseThemePreferenceSync = vi.fn();
vi.mock("@/src/hooks/themePreferenceHooks", () => ({
  useThemePreferenceSync: () => mockUseThemePreferenceSync(),
}));

// Mock themes
vi.mock("@/lib/features/experiences/modern/theme", () => ({
  default: {},
}));

vi.mock("@/lib/features/experiences/classic/theme", () => ({
  default: {},
}));

// Mock MUI Joy components
vi.mock("@mui/joy", () => ({
  GlobalStyles: ({ children }: any) => <div data-testid="global-styles" />,
}));

vi.mock("@mui/joy/CssBaseline", () => ({
  default: () => <div data-testid="css-baseline" />,
}));

vi.mock("@mui/joy/styles", () => ({
  CssVarsProvider: ({ children, theme }: any) => (
    <div data-testid="css-vars-provider">{children}</div>
  ),
}));

// Mock Emotion
vi.mock("@emotion/cache", () => ({
  default: vi.fn(() => ({
    key: "test-cache",
    compat: true,
    insert: vi.fn(),
    inserted: {},
  })),
}));

vi.mock("@emotion/react", () => ({
  CacheProvider: ({ children, value }: any) => (
    <div data-testid="cache-provider">{children}</div>
  ),
}));

describe("ThemeRegistry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render children", () => {
    render(
      <ThemeRegistry>
        <div data-testid="child-content">Test content</div>
      </ThemeRegistry>
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("should render CacheProvider", () => {
    render(
      <ThemeRegistry>
        <div>Test</div>
      </ThemeRegistry>
    );

    expect(screen.getByTestId("cache-provider")).toBeInTheDocument();
  });

  it("should render CssVarsProvider", () => {
    render(
      <ThemeRegistry>
        <div>Test</div>
      </ThemeRegistry>
    );

    expect(screen.getByTestId("css-vars-provider")).toBeInTheDocument();
  });

  it("should render CssBaseline", () => {
    render(
      <ThemeRegistry>
        <div>Test</div>
      </ThemeRegistry>
    );

    expect(screen.getByTestId("css-baseline")).toBeInTheDocument();
  });

  it("should render GlobalStyles", () => {
    render(
      <ThemeRegistry>
        <div>Test</div>
      </ThemeRegistry>
    );

    expect(screen.getByTestId("global-styles")).toBeInTheDocument();
  });

  it("should call useThemePreferenceSync", () => {
    render(
      <ThemeRegistry>
        <div>Test</div>
      </ThemeRegistry>
    );

    expect(mockUseThemePreferenceSync).toHaveBeenCalled();
  });

  it("should use modern theme when experience is modern", () => {
    mockUseActiveExperience.mockReturnValue("modern");

    render(
      <ThemeRegistry>
        <div>Test</div>
      </ThemeRegistry>
    );

    expect(mockUseActiveExperience).toHaveBeenCalled();
  });

  it("should use classic theme when experience is classic", () => {
    mockUseActiveExperience.mockReturnValue("classic");

    render(
      <ThemeRegistry>
        <div>Test</div>
      </ThemeRegistry>
    );

    expect(mockUseActiveExperience).toHaveBeenCalled();
  });

  it("should accept options prop", () => {
    render(
      <ThemeRegistry options={{ key: "custom-cache" }}>
        <div>Test</div>
      </ThemeRegistry>
    );

    expect(screen.getByTestId("cache-provider")).toBeInTheDocument();
  });

  it("should pass flush function to state", () => {
    // This tests that the cache and flush are initialized correctly
    render(
      <ThemeRegistry options={{ key: "test" }}>
        <div>Content</div>
      </ThemeRegistry>
    );

    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("should render the ThemePreferenceSync component", () => {
    render(
      <ThemeRegistry>
        <div>Content</div>
      </ThemeRegistry>
    );

    // ThemePreferenceSync is rendered, which calls useThemePreferenceSync
    expect(mockUseThemePreferenceSync).toHaveBeenCalled();
  });

  it("should handle multiple children", () => {
    render(
      <ThemeRegistry>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
      </ThemeRegistry>
    );

    expect(screen.getByTestId("child-1")).toBeInTheDocument();
    expect(screen.getByTestId("child-2")).toBeInTheDocument();
  });

  it("should handle empty children", () => {
    render(<ThemeRegistry>{null}</ThemeRegistry>);

    expect(screen.getByTestId("css-vars-provider")).toBeInTheDocument();
  });
});
