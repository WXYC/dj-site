import { describe, expect, it } from "vitest";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";

describe("REVIEW_COPY.screen", () => {
  it("never calls the review shelf by its old name", () => {
    expect(JSON.stringify(REVIEW_COPY)).not.toMatch(/\b(pile|pool)\b/i);
  });
});

describe("REVIEW_COPY.intake passes band", () => {
  it("pins the approved wording", () => {
    expect(REVIEW_COPY.intake.recentPasses).toBe("Recent passes");
    expect(REVIEW_COPY.intake.passedLine("Pat", "Juana Molina", "DOGA")).toBe("Pat passed on Juana Molina — DOGA");
  });
});
