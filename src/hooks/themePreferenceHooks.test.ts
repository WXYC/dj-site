import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildPreference } from "./themePreferenceHooks";

// Mock dependencies
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    useSession: vi.fn(() => ({ data: null })),
    updateUser: vi.fn(),
  },
}));

vi.mock("@/lib/features/experiences/api", () => ({
  useSetExperiencePreferenceMutation: vi.fn(() => [vi.fn(), {}]),
}));

vi.mock("@mui/joy/styles", () => ({
  useColorScheme: vi.fn(() => ({ mode: "light", setMode: vi.fn() })),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

describe("themePreferenceHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildPreference", () => {
    it.each([
      ["classic", "light", "classic-light"],
      ["classic", "dark", "classic-dark"],
      ["modern", "light", "modern-light"],
      ["modern", "dark", "modern-dark"],
    ] as const)(
      'should build "%s-%s" preference',
      (experience, colorMode, expected) => {
        expect(buildPreference(experience, colorMode)).toBe(expected);
      }
    );

    it("should return a valid AppSkinPreference type", () => {
      const result = buildPreference("modern", "dark");
      expect(typeof result).toBe("string");
      expect(result).toMatch(/^(classic|modern)-(light|dark)$/);
    });
  });
});
