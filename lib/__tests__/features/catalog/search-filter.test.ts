import { describe, it, expect } from "vitest";
import { SearchIn } from "@/lib/features/catalog/types";
import { defaultCatalogFrontendState } from "@/lib/features/catalog/frontend";

describe("catalog search filter type alignment (Bug 42)", () => {
  const VALID_SELECT_OPTIONS: SearchIn[] = ["All", "Albums", "Artists"];

  it("should have a default searchIn value that matches a valid Select option", () => {
    const defaultSearchIn = defaultCatalogFrontendState.search.in;
    expect(VALID_SELECT_OPTIONS).toContain(defaultSearchIn);
  });

  it("should use 'All' as the default searchIn, not 'Both'", () => {
    expect(defaultCatalogFrontendState.search.in).toBe("All");
  });

  it("SearchIn type should include 'All' as a valid value", () => {
    const allValue: SearchIn = "All";
    expect(allValue).toBe("All");
  });
});
