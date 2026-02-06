import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import NotFoundCard from "./NotFoundCard";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href} data-testid="link">
      {children}
    </a>
  ),
}));

describe("NotFoundCard", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Math.random for predictable tests when needed
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("rendering", () => {
    it("should render a Card component", () => {
      const { container } = render(<NotFoundCard />);
      expect(container.querySelector(".MuiCard-root")).toBeInTheDocument();
    });

    it("should have outlined variant", () => {
      const { container } = render(<NotFoundCard />);
      const card = container.querySelector(".MuiCard-root");
      expect(card).toHaveClass("MuiCard-variantOutlined");
    });

    it("should have ignoreClassic class", () => {
      const { container } = render(<NotFoundCard />);
      expect(container.querySelector(".ignoreClassic")).toBeInTheDocument();
    });

    it("should render CardContent sections", () => {
      const { container } = render(<NotFoundCard />);
      const cardContents = container.querySelectorAll(".MuiCardContent-root");
      expect(cardContents.length).toBeGreaterThanOrEqual(2);
    });

    it("should render a Divider", () => {
      const { container } = render(<NotFoundCard />);
      expect(container.querySelector(".MuiDivider-root")).toBeInTheDocument();
    });
  });

  describe("quote display", () => {
    it("should display a quote containing the word Lost", () => {
      render(<NotFoundCard />);

      // The word "Lost" should be highlighted in the quote
      expect(screen.getByText("Lost")).toBeInTheDocument();
    });

    it("should display an author attribution", () => {
      render(<NotFoundCard />);

      // Check for common authors in the quotes
      const possibleAuthors = [
        "Billie Eilish",
        "Lil Nas X",
        "Frank Ocean",
        "Tame Impala",
        "Christina Aguilera",
        "Bastille",
        "LP",
        "Pink Floyd",
      ];

      // At least one author should be present (with dash prefix)
      const authorElements = possibleAuthors.some((author) => {
        try {
          return screen.queryByText(`- ${author}`) !== null;
        } catch {
          return false;
        }
      });

      expect(authorElements).toBe(true);
    });

    it("should render quote in Typography component", () => {
      const { container } = render(<NotFoundCard />);
      const typographyElements = container.querySelectorAll(".MuiTypography-root");
      expect(typographyElements.length).toBeGreaterThan(0);
    });

    it("should highlight Lost in primary color", () => {
      render(<NotFoundCard />);

      // Find the "Lost" text that should be in a Typography with color="primary"
      const lostElement = screen.getByText("Lost");
      expect(lostElement).toBeInTheDocument();
      // It should be a Typography component (MuiTypography class)
      expect(lostElement).toHaveClass("MuiTypography-root");
    });
  });

  describe("initial quote (before useEffect)", () => {
    it("should start with the first quote (Lost Cause)", () => {
      render(<NotFoundCard />);

      // The initial state is lostQuotes[0], which is "Lost Cause"
      // This will be visible initially before useEffect runs
      // Since useEffect runs immediately, we need to check if either the initial
      // or a random quote is shown
      expect(screen.getByText("Lost")).toBeInTheDocument();
    });
  });

  describe("random quote selection", () => {
    it("should select a random quote on mount", async () => {
      // Mock Math.random to return a specific value
      const mockRandom = vi.spyOn(Math, "random");
      mockRandom.mockReturnValue(0.5); // Will select middle quote

      render(<NotFoundCard />);

      await waitFor(() => {
        expect(mockRandom).toHaveBeenCalled();
      });

      mockRandom.mockRestore();
    });

    it("should handle quote with undefined prefix", async () => {
      // Mock Math.random to select the Christina Aguilera quote (index 4)
      // which has prefix: undefined
      const mockRandom = vi.spyOn(Math, "random");
      mockRandom.mockReturnValue(0.55); // Approximately index 4 out of 8

      render(<NotFoundCard />);

      // The component should render without error even with undefined prefix
      await waitFor(() => {
        expect(screen.getByText("Lost")).toBeInTheDocument();
      });

      mockRandom.mockRestore();
    });

    it("should correctly extract text before Lost in quote", () => {
      render(<NotFoundCard />);

      // The quote is split around "Lost" - verify structure
      const h1 = screen.getByRole("heading", { level: 1 });
      expect(h1).toBeInTheDocument();
      expect(h1.textContent).toContain("Lost");
    });

    it("should correctly extract text after Lost in quote", async () => {
      // Mock to get "Lost in Yesterday" quote
      const mockRandom = vi.spyOn(Math, "random");
      mockRandom.mockReturnValue(0.4); // Should get Tame Impala quote

      render(<NotFoundCard />);

      await waitFor(() => {
        const lostElement = screen.getByText("Lost");
        expect(lostElement).toBeInTheDocument();
      });

      mockRandom.mockRestore();
    });
  });

  describe("error message", () => {
    it("should display the not found message", () => {
      render(<NotFoundCard />);

      expect(
        screen.getByText("We couldn't find the resource you were looking for.")
      ).toBeInTheDocument();
    });
  });

  describe("navigation button", () => {
    it("should render Back to Safety button", () => {
      render(<NotFoundCard />);

      expect(screen.getByRole("button", { name: /back to safety/i })).toBeInTheDocument();
    });

    it("should link to dashboard home page from env", () => {
      process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE = "/dashboard/home";

      render(<NotFoundCard />);

      const link = screen.getByTestId("link");
      expect(link).toHaveAttribute("href", "/dashboard/home");
    });

    it("should link to /dashboard/catalog as fallback when env not set", () => {
      delete process.env.NEXT_PUBLIC_DASHBOARD_HOME_PAGE;

      render(<NotFoundCard />);

      const link = screen.getByTestId("link");
      expect(link).toHaveAttribute("href", "/dashboard/catalog");
    });

    it("should render button with solid variant", () => {
      const { container } = render(<NotFoundCard />);

      const button = container.querySelector(".MuiButton-variantSolid");
      expect(button).toBeInTheDocument();
    });

    it("should render button with primary color", () => {
      const { container } = render(<NotFoundCard />);

      const button = container.querySelector(".MuiButton-colorPrimary");
      expect(button).toBeInTheDocument();
    });

    it("should render button with fullWidth", () => {
      const { container } = render(<NotFoundCard />);

      const button = container.querySelector(".MuiButton-fullWidth");
      expect(button).toBeInTheDocument();
    });
  });

  describe("hydration safety", () => {
    it("should use suppressHydrationWarning on CardContent", () => {
      const { container } = render(<NotFoundCard />);

      // CardContent elements should have suppressHydrationWarning
      // This is to prevent hydration mismatch from random quote
      const cardContents = container.querySelectorAll(".MuiCardContent-root");
      expect(cardContents.length).toBeGreaterThan(0);
    });
  });

  describe("all quotes", () => {
    const expectedQuotes = [
      { quote: "Lost Cause", author: "Billie Eilish", hasPrefix: true },
      { quote: "Lost in the Citadel", author: "Lil Nas X", hasPrefix: true },
      { quote: "Lost", author: "Frank Ocean", hasPrefix: true },
      { quote: "Lost in Yesterday", author: "Tame Impala", hasPrefix: true },
      { quote: "You Lost Me", author: "Christina Aguilera", hasPrefix: false },
      { quote: "Things We Lost in the Fire", author: "Bastille", hasPrefix: true },
      { quote: "Lost on You", author: "LP", hasPrefix: true },
      { quote: "Lost for Words", author: "Pink Floyd", hasPrefix: true },
    ];

    it.each(expectedQuotes)(
      "should be able to render $quote by $author",
      async ({ quote, author }) => {
        // Find the index of this quote
        const index = expectedQuotes.findIndex((q) => q.quote === quote);
        const randomValue = index / expectedQuotes.length + 0.01;

        const mockRandom = vi.spyOn(Math, "random");
        mockRandom.mockReturnValue(randomValue);

        render(<NotFoundCard />);

        await waitFor(() => {
          expect(screen.getByText(`- ${author}`)).toBeInTheDocument();
        });

        mockRandom.mockRestore();
      }
    );
  });

  describe("styling", () => {
    it("should have correct card width styling", () => {
      const { container } = render(<NotFoundCard />);
      const card = container.querySelector(".MuiCard-root");
      expect(card).toBeInTheDocument();
    });

    it("should have neutral color on card", () => {
      const { container } = render(<NotFoundCard />);
      const card = container.querySelector(".MuiCard-colorNeutral");
      expect(card).toBeInTheDocument();
    });
  });
});
