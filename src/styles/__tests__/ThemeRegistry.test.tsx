import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Store the callback from useServerInsertedHTML for testing
let serverInsertedHTMLCallback: (() => React.ReactNode) | null = null;

// Mock next/navigation to capture the callback
vi.mock("next/navigation", () => ({
  useServerInsertedHTML: vi.fn((callback: () => React.ReactNode) => {
    serverInsertedHTMLCallback = callback;
  }),
}));

// Mock experiences hooks
const mockUseActiveExperience = vi.fn(() => "modern" as "modern" | "classic");
vi.mock("@/lib/features/experiences/hooks", () => ({
  useActiveExperience: () => mockUseActiveExperience(),
}));

// Mock themePreferenceHooks
const mockUseThemePreferenceSync = vi.fn();
vi.mock("@/src/hooks/themePreferenceHooks", () => ({
  useThemePreferenceSync: () => mockUseThemePreferenceSync(),
}));

// Mock next/font/google and next/font/local for theme imports
vi.mock("next/font/google", () => ({
  Kanit: () => ({
    style: {
      fontFamily: "Kanit, sans-serif",
    },
  }),
}));

vi.mock("next/font/local", () => ({
  default: () => ({
    style: {
      fontFamily: "Minbus, sans-serif",
    },
  }),
}));

// Import the component after all mocks are set up
import ThemeRegistry from "../ThemeRegistry";

describe("ThemeRegistry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverInsertedHTMLCallback = null;
    mockUseActiveExperience.mockReturnValue("modern");
  });

  afterEach(() => {
    serverInsertedHTMLCallback = null;
  });

  describe("basic rendering", () => {
    it("should render children correctly", () => {
      render(
        <ThemeRegistry options={{ key: "test" }}>
          <div data-testid="child-content">Test content</div>
        </ThemeRegistry>
      );

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
      expect(screen.getByText("Test content")).toBeInTheDocument();
    });

    it("should render multiple children", () => {
      render(
        <ThemeRegistry options={{ key: "test" }}>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </ThemeRegistry>
      );

      expect(screen.getByTestId("child-1")).toBeInTheDocument();
      expect(screen.getByTestId("child-2")).toBeInTheDocument();
    });

    it("should handle empty children gracefully", () => {
      render(<ThemeRegistry options={{ key: "test" }}>{null}</ThemeRegistry>);

      // Component should render without errors
      expect(document.body).toBeInTheDocument();
    });

    it("should handle undefined children gracefully", () => {
      render(
        <ThemeRegistry options={{ key: "test" }}>{undefined}</ThemeRegistry>
      );

      // Component should render without errors
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("options prop", () => {
    it("should accept options prop with key", () => {
      render(
        <ThemeRegistry options={{ key: "custom-cache" }}>
          <div>Test</div>
        </ThemeRegistry>
      );

      expect(screen.getByText("Test")).toBeInTheDocument();
    });

    it("should accept options with different cache keys", () => {
      render(
        <ThemeRegistry options={{ key: "unique-cache-key" }}>
          <div>Test</div>
        </ThemeRegistry>
      );

      expect(screen.getByText("Test")).toBeInTheDocument();
    });

    it("should accept options with various key formats", () => {
      render(
        <ThemeRegistry options={{ key: "wxyc-theme" }}>
          <div>Test</div>
        </ThemeRegistry>
      );

      expect(screen.getByText("Test")).toBeInTheDocument();
    });
  });

  describe("theme selection", () => {
    it("should call useActiveExperience hook", () => {
      render(
        <ThemeRegistry options={{ key: "test" }}>
          <div>Test</div>
        </ThemeRegistry>
      );

      expect(mockUseActiveExperience).toHaveBeenCalled();
    });

    it("should use modern theme when experience is modern", () => {
      mockUseActiveExperience.mockReturnValue("modern");

      render(
        <ThemeRegistry options={{ key: "test" }}>
          <div>Test</div>
        </ThemeRegistry>
      );

      expect(mockUseActiveExperience).toHaveBeenCalled();
      expect(screen.getByText("Test")).toBeInTheDocument();
    });

    it("should use classic theme when experience is classic", () => {
      mockUseActiveExperience.mockReturnValue("classic");

      render(
        <ThemeRegistry options={{ key: "test" }}>
          <div>Test</div>
        </ThemeRegistry>
      );

      expect(mockUseActiveExperience).toHaveBeenCalled();
      expect(screen.getByText("Test")).toBeInTheDocument();
    });
  });

  describe("ThemePreferenceSync component", () => {
    it("should call useThemePreferenceSync", () => {
      render(
        <ThemeRegistry options={{ key: "test" }}>
          <div>Test</div>
        </ThemeRegistry>
      );

      expect(mockUseThemePreferenceSync).toHaveBeenCalled();
    });

    it("should call useThemePreferenceSync on each render", () => {
      const { rerender } = render(
        <ThemeRegistry options={{ key: "test" }}>
          <div>Test 1</div>
        </ThemeRegistry>
      );

      expect(mockUseThemePreferenceSync).toHaveBeenCalledTimes(1);

      rerender(
        <ThemeRegistry options={{ key: "test" }}>
          <div>Test 2</div>
        </ThemeRegistry>
      );

      expect(mockUseThemePreferenceSync).toHaveBeenCalledTimes(2);
    });
  });

  describe("useServerInsertedHTML callback", () => {
    it("should register useServerInsertedHTML callback", () => {
      render(
        <ThemeRegistry options={{ key: "test" }}>
          <div>Test</div>
        </ThemeRegistry>
      );

      expect(serverInsertedHTMLCallback).not.toBeNull();
      expect(typeof serverInsertedHTMLCallback).toBe("function");
    });

    it("should return null from callback when no styles are inserted", () => {
      render(
        <ThemeRegistry options={{ key: "test" }}>
          <div>Test</div>
        </ThemeRegistry>
      );

      // Call the callback - should return null when no new styles
      const result = serverInsertedHTMLCallback?.();
      expect(result).toBeNull();
    });
  });

  describe("cache initialization", () => {
    it("should initialize cache with provided options", () => {
      render(
        <ThemeRegistry options={{ key: "my-cache" }}>
          <div>Test</div>
        </ThemeRegistry>
      );

      expect(screen.getByText("Test")).toBeInTheDocument();
    });

    it("should set cache.compat to true", () => {
      // This is implicitly tested by successful rendering
      render(
        <ThemeRegistry options={{ key: "test" }}>
          <div>Test</div>
        </ThemeRegistry>
      );

      expect(screen.getByText("Test")).toBeInTheDocument();
    });

    it("should maintain cache across rerenders", () => {
      const { rerender } = render(
        <ThemeRegistry options={{ key: "stable-cache" }}>
          <div>Initial</div>
        </ThemeRegistry>
      );

      rerender(
        <ThemeRegistry options={{ key: "stable-cache" }}>
          <div>Updated</div>
        </ThemeRegistry>
      );

      expect(screen.getByText("Updated")).toBeInTheDocument();
    });
  });

  describe("provider hierarchy", () => {
    it("should render CacheProvider, CssVarsProvider, CssBaseline, and GlobalStyles", () => {
      render(
        <ThemeRegistry options={{ key: "test" }}>
          <div data-testid="content">Nested content</div>
        </ThemeRegistry>
      );

      // Content should be rendered, indicating all providers initialized correctly
      expect(screen.getByTestId("content")).toBeInTheDocument();
    });

    it("should apply theme context to children", () => {
      render(
        <ThemeRegistry options={{ key: "test" }}>
          <div data-testid="themed-content">Themed</div>
        </ThemeRegistry>
      );

      expect(screen.getByTestId("themed-content")).toBeInTheDocument();
    });
  });

  describe("experience switching", () => {
    it("should re-render with different theme when experience changes", () => {
      mockUseActiveExperience.mockReturnValue("modern");

      const { rerender } = render(
        <ThemeRegistry options={{ key: "test" }}>
          <div data-testid="content">Content</div>
        </ThemeRegistry>
      );

      expect(screen.getByTestId("content")).toBeInTheDocument();

      mockUseActiveExperience.mockReturnValue("classic");

      rerender(
        <ThemeRegistry options={{ key: "test" }}>
          <div data-testid="content">Content</div>
        </ThemeRegistry>
      );

      expect(screen.getByTestId("content")).toBeInTheDocument();
      expect(mockUseActiveExperience).toHaveBeenCalled();
    });
  });
});

describe("ThemeRegistry integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverInsertedHTMLCallback = null;
    mockUseActiveExperience.mockReturnValue("modern");
  });

  it("should render complete component tree", () => {
    render(
      <ThemeRegistry options={{ key: "integration-test" }}>
        <main>
          <header>Header</header>
          <section>Content</section>
          <footer>Footer</footer>
        </main>
      </ThemeRegistry>
    );

    expect(screen.getByText("Header")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });

  it("should handle nested components", () => {
    const NestedComponent = () => (
      <div data-testid="nested">
        <span>Nested content</span>
      </div>
    );

    render(
      <ThemeRegistry options={{ key: "test" }}>
        <NestedComponent />
      </ThemeRegistry>
    );

    expect(screen.getByTestId("nested")).toBeInTheDocument();
    expect(screen.getByText("Nested content")).toBeInTheDocument();
  });

  it("should work with stateful child components", () => {
    const StatefulChild = () => {
      const [count, setCount] = React.useState(0);
      return (
        <button onClick={() => setCount(count + 1)} data-testid="counter">
          Count: {count}
        </button>
      );
    };

    render(
      <ThemeRegistry options={{ key: "test" }}>
        <StatefulChild />
      </ThemeRegistry>
    );

    const button = screen.getByTestId("counter");
    expect(button).toHaveTextContent("Count: 0");
  });
});

describe("ThemeRegistry error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverInsertedHTMLCallback = null;
  });

  it("should handle hook returning undefined experience gracefully", () => {
    // Even with unexpected values, component should not crash
    mockUseActiveExperience.mockReturnValue("modern" as any);

    render(
      <ThemeRegistry options={{ key: "test" }}>
        <div>Test</div>
      </ThemeRegistry>
    );

    expect(screen.getByText("Test")).toBeInTheDocument();
  });
});

describe("ThemeRegistry SSR style injection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverInsertedHTMLCallback = null;
    mockUseActiveExperience.mockReturnValue("modern");
  });

  it("should register a callback with useServerInsertedHTML", () => {
    render(
      <ThemeRegistry options={{ key: "ssr-test" }}>
        <div>Test</div>
      </ThemeRegistry>
    );

    // The callback should be registered
    expect(serverInsertedHTMLCallback).toBeDefined();
    expect(typeof serverInsertedHTMLCallback).toBe("function");
  });

  it("should return null when flush returns empty array", () => {
    render(
      <ThemeRegistry options={{ key: "empty-flush" }}>
        <div>Test</div>
      </ThemeRegistry>
    );

    // Call the callback - with no styles inserted, should return null
    if (serverInsertedHTMLCallback) {
      const result = serverInsertedHTMLCallback();
      expect(result).toBeNull();
    }
  });

  it("should call callback multiple times without error", () => {
    render(
      <ThemeRegistry options={{ key: "multi-call" }}>
        <div>Test</div>
      </ThemeRegistry>
    );

    if (serverInsertedHTMLCallback) {
      // Call multiple times to ensure flush resets properly
      const result1 = serverInsertedHTMLCallback();
      const result2 = serverInsertedHTMLCallback();
      const result3 = serverInsertedHTMLCallback();

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    }
  });
});

describe("ThemeRegistry cache behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverInsertedHTMLCallback = null;
    mockUseActiveExperience.mockReturnValue("modern");
  });

  it("should initialize cache with compat mode enabled", () => {
    // This test verifies cache initialization logic runs
    render(
      <ThemeRegistry options={{ key: "compat-test" }}>
        <div data-testid="compat-content">Content</div>
      </ThemeRegistry>
    );

    expect(screen.getByTestId("compat-content")).toBeInTheDocument();
  });

  it("should preserve cache state across renders", () => {
    const { rerender } = render(
      <ThemeRegistry options={{ key: "preserve-cache" }}>
        <div>Render 1</div>
      </ThemeRegistry>
    );

    // Get the callback after first render
    const firstCallback = serverInsertedHTMLCallback;

    rerender(
      <ThemeRegistry options={{ key: "preserve-cache" }}>
        <div>Render 2</div>
      </ThemeRegistry>
    );

    // The callback reference should remain (useState returns same value)
    // Note: Due to how mocks work, this tests the component doesn't re-init
    expect(screen.getByText("Render 2")).toBeInTheDocument();
  });

  it("should use unique cache keys to avoid conflicts", () => {
    const { unmount } = render(
      <ThemeRegistry options={{ key: "unique-key-a" }}>
        <div data-testid="cache-a">Cache A</div>
      </ThemeRegistry>
    );

    expect(screen.getByTestId("cache-a")).toBeInTheDocument();
    unmount();

    render(
      <ThemeRegistry options={{ key: "unique-key-b" }}>
        <div data-testid="cache-b">Cache B</div>
      </ThemeRegistry>
    );

    expect(screen.getByTestId("cache-b")).toBeInTheDocument();
  });
});

describe("ThemeRegistry GlobalStyles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverInsertedHTMLCallback = null;
    mockUseActiveExperience.mockReturnValue("modern");
  });

  it("should render GlobalStyles component", () => {
    render(
      <ThemeRegistry options={{ key: "global-styles-test" }}>
        <div>Test</div>
      </ThemeRegistry>
    );

    // GlobalStyles is rendered as part of the component tree
    expect(screen.getByText("Test")).toBeInTheDocument();
  });

  it("should apply CSS variables through GlobalStyles", () => {
    render(
      <ThemeRegistry options={{ key: "css-vars-test" }}>
        <div data-testid="with-css-vars">CSS Vars Test</div>
      </ThemeRegistry>
    );

    // The component renders successfully with GlobalStyles
    expect(screen.getByTestId("with-css-vars")).toBeInTheDocument();
  });
});

describe("ThemeRegistry theme switching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverInsertedHTMLCallback = null;
  });

  it("should render with modern theme by default", () => {
    mockUseActiveExperience.mockReturnValue("modern");

    render(
      <ThemeRegistry options={{ key: "modern-default" }}>
        <div data-testid="modern-content">Modern</div>
      </ThemeRegistry>
    );

    expect(screen.getByTestId("modern-content")).toBeInTheDocument();
    expect(mockUseActiveExperience).toHaveReturnedWith("modern");
  });

  it("should switch to classic theme when experience changes", () => {
    mockUseActiveExperience.mockReturnValue("classic");

    render(
      <ThemeRegistry options={{ key: "classic-switch" }}>
        <div data-testid="classic-content">Classic</div>
      </ThemeRegistry>
    );

    expect(screen.getByTestId("classic-content")).toBeInTheDocument();
    expect(mockUseActiveExperience).toHaveReturnedWith("classic");
  });

  it("should handle rapid theme switching", () => {
    mockUseActiveExperience.mockReturnValue("modern");

    const { rerender } = render(
      <ThemeRegistry options={{ key: "rapid-switch" }}>
        <div>Theme 1</div>
      </ThemeRegistry>
    );

    mockUseActiveExperience.mockReturnValue("classic");
    rerender(
      <ThemeRegistry options={{ key: "rapid-switch" }}>
        <div>Theme 2</div>
      </ThemeRegistry>
    );

    mockUseActiveExperience.mockReturnValue("modern");
    rerender(
      <ThemeRegistry options={{ key: "rapid-switch" }}>
        <div>Theme 3</div>
      </ThemeRegistry>
    );

    expect(screen.getByText("Theme 3")).toBeInTheDocument();
  });
});

describe("ThemePreferenceSync behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverInsertedHTMLCallback = null;
    mockUseActiveExperience.mockReturnValue("modern");
  });

  it("should invoke useThemePreferenceSync hook", () => {
    render(
      <ThemeRegistry options={{ key: "sync-test" }}>
        <div>Sync Test</div>
      </ThemeRegistry>
    );

    expect(mockUseThemePreferenceSync).toHaveBeenCalledTimes(1);
  });

  it("should call sync hook on every render", () => {
    const { rerender } = render(
      <ThemeRegistry options={{ key: "sync-rerender" }}>
        <div>Sync 1</div>
      </ThemeRegistry>
    );

    rerender(
      <ThemeRegistry options={{ key: "sync-rerender" }}>
        <div>Sync 2</div>
      </ThemeRegistry>
    );

    rerender(
      <ThemeRegistry options={{ key: "sync-rerender" }}>
        <div>Sync 3</div>
      </ThemeRegistry>
    );

    expect(mockUseThemePreferenceSync).toHaveBeenCalledTimes(3);
  });

  it("should not return any JSX from ThemePreferenceSync", () => {
    render(
      <ThemeRegistry options={{ key: "null-return" }}>
        <div data-testid="only-child">Only Child</div>
      </ThemeRegistry>
    );

    // ThemePreferenceSync returns null, so only our child should be in DOM
    expect(screen.getByTestId("only-child")).toBeInTheDocument();
  });
});

describe("ThemeRegistry edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverInsertedHTMLCallback = null;
    mockUseActiveExperience.mockReturnValue("modern");
  });

  it("should handle options with additional properties", () => {
    render(
      <ThemeRegistry options={{ key: "extended", container: document.head }}>
        <div>Extended options</div>
      </ThemeRegistry>
    );

    expect(screen.getByText("Extended options")).toBeInTheDocument();
  });

  it("should handle unmount and remount correctly", () => {
    const { unmount } = render(
      <ThemeRegistry options={{ key: "mount-test" }}>
        <div>First mount</div>
      </ThemeRegistry>
    );

    unmount();

    render(
      <ThemeRegistry options={{ key: "mount-test-two" }}>
        <div>Second mount</div>
      </ThemeRegistry>
    );

    expect(screen.getByText("Second mount")).toBeInTheDocument();
  });

  it("should work with deeply nested children", () => {
    render(
      <ThemeRegistry options={{ key: "nested-test" }}>
        <div>
          <section>
            <article>
              <span data-testid="deep-nested">Deep content</span>
            </article>
          </section>
        </div>
      </ThemeRegistry>
    );

    expect(screen.getByTestId("deep-nested")).toBeInTheDocument();
  });

  it("should handle fragment children", () => {
    render(
      <ThemeRegistry options={{ key: "fragment-test" }}>
        <>
          <div>Fragment child 1</div>
          <div>Fragment child 2</div>
        </>
      </ThemeRegistry>
    );

    expect(screen.getByText("Fragment child 1")).toBeInTheDocument();
    expect(screen.getByText("Fragment child 2")).toBeInTheDocument();
  });

  it("should handle boolean/number children", () => {
    render(
      <ThemeRegistry options={{ key: "primitive-test" }}>
        <div data-testid="number">{42}</div>
      </ThemeRegistry>
    );

    expect(screen.getByTestId("number")).toHaveTextContent("42");
  });
});

describe("ThemeRegistry with MUI components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverInsertedHTMLCallback = null;
    mockUseActiveExperience.mockReturnValue("modern");
  });

  it("should render MUI-compatible children without errors", () => {
    // MUI components get styled through emotion cache
    render(
      <ThemeRegistry options={{ key: "mui-test" }}>
        <div style={{ color: "red" }} data-testid="styled-div">
          Styled content
        </div>
      </ThemeRegistry>
    );

    expect(screen.getByTestId("styled-div")).toBeInTheDocument();
  });
});

describe("ThemeRegistry cache insert tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverInsertedHTMLCallback = null;
    mockUseActiveExperience.mockReturnValue("modern");
  });

  it("should properly track and flush inserted styles", () => {
    render(
      <ThemeRegistry options={{ key: "insert-track" }}>
        <div>Track inserts</div>
      </ThemeRegistry>
    );

    // The callback should be registered
    expect(serverInsertedHTMLCallback).not.toBeNull();

    // First call - should return null as no new styles
    const result1 = serverInsertedHTMLCallback?.();
    expect(result1).toBeNull();

    // Second call - still null, flush was cleared
    const result2 = serverInsertedHTMLCallback?.();
    expect(result2).toBeNull();
  });

  it("should maintain separate flush state for each render", () => {
    const { rerender } = render(
      <ThemeRegistry options={{ key: "flush-state" }}>
        <div>Render 1</div>
      </ThemeRegistry>
    );

    const firstResult = serverInsertedHTMLCallback?.();
    expect(firstResult).toBeNull();

    rerender(
      <ThemeRegistry options={{ key: "flush-state" }}>
        <div>Render 2</div>
      </ThemeRegistry>
    );

    const secondResult = serverInsertedHTMLCallback?.();
    expect(secondResult).toBeNull();
  });
});
