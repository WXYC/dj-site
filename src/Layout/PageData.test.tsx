import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import PageData from "./PageData";

// Mock next/head
vi.mock("next/head", () => ({
  default: ({ children }: any) => <>{children}</>,
}));

describe("PageData", () => {
  it("should render title with site prefix", () => {
    render(<PageData title="Test Page" />);

    expect(document.title).toBe("WXYC | Test Page");
  });

  it("should render different titles", () => {
    render(<PageData title="Dashboard" />);

    expect(document.title).toBe("WXYC | Dashboard");
  });

  it("should include WXYC prefix", () => {
    render(<PageData title="Login" />);

    expect(document.title).toContain("WXYC");
  });
});
