import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import PageData from "./PageData";

// Mock next/head
vi.mock("next/head", () => ({
  default: ({ children }: any) => <>{children}</>,
}));

describe("PageData", () => {
  it("should render title with site prefix", () => {
    const { container } = render(<PageData title="Test Page" />);

    const title = container.querySelector("title");
    expect(title?.textContent).toBe("WXYC | Test Page");
  });

  it("should render different titles", () => {
    const { container } = render(<PageData title="Dashboard" />);

    const title = container.querySelector("title");
    expect(title?.textContent).toBe("WXYC | Dashboard");
  });

  it("should include WXYC prefix", () => {
    const { container } = render(<PageData title="Login" />);

    const title = container.querySelector("title");
    expect(title?.textContent).toContain("WXYC");
  });
});
