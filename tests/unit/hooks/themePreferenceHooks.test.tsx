import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockUseSession = vi.fn();
const mockUpdateUser = vi.fn();
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    useSession: (...a: unknown[]) => mockUseSession(...a),
    updateUser: (...a: unknown[]) => mockUpdateUser(...a),
  },
}));

// Partial-mock Joy so the theme registry's own Joy imports stay real; only the
// color-scheme hook is swapped for one we drive.
const mockUseColorScheme = vi.fn();
vi.mock("@mui/joy/styles", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mui/joy/styles")>();
  return { ...actual, useColorScheme: () => mockUseColorScheme() };
});

const mockUseModernTheme = vi.fn();
vi.mock("@/src/styles/ModernThemeContext", () => ({
  useModernTheme: () => mockUseModernTheme(),
}));

const mockSetPreference = vi.fn();
vi.mock("@/lib/features/experiences/api", () => ({
  useSetExperiencePreferenceMutation: () => [mockSetPreference],
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useThemePreferenceSync } from "@/src/hooks/themePreferenceHooks";

// vitest.setup.ts replaces window.localStorage with a vi.fn() mock (setItem is
// a no-op), so tests seed the store by stubbing getItem's return value.
function setLocalPreference(value: string | null) {
  vi.mocked(window.localStorage.getItem).mockReturnValue(value);
}

const mockSetMode = vi.fn();
const mockSetThemeId = vi.fn();

function setColorScheme(mode: string | undefined) {
  mockUseColorScheme.mockReturnValue({ mode, setMode: mockSetMode });
}
function setModernTheme(themeId = "stacks") {
  mockUseModernTheme.mockReturnValue({ themeId, setThemeId: mockSetThemeId });
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

const realLocation = window.location;
const mockReload = vi.fn();

describe("useThemePreferenceSync (#611)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocalPreference(null);
    delete document.documentElement.dataset.experience;
    setColorScheme("light");
    setModernTheme("stacks");
    mockSetPreference.mockReturnValue({ unwrap: () => Promise.resolve(undefined) });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...realLocation, reload: mockReload },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: realLocation,
    });
  });

  it("does not start a second sync (double persist) when the session's appSkin arrives mid-fetch", async () => {
    // No appSkin and no localStorage forces the fetchAppState path, opening a
    // window in which the session's appSkin can arrive and re-fire the effect.
    mockUseSession.mockReturnValue({ data: { user: { id: "u1" } } });
    let resolveFetch!: (v: unknown) => void;
    const fetchP = new Promise((r) => { resolveFetch = r; });
    vi.stubGlobal("fetch", vi.fn(() => fetchP));

    const { rerender } = renderHook(() => useThemePreferenceSync());

    // Session resolves with an appSkin mid-fetch — the effect re-fires.
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1", appSkin: "modern-stacks-light" } },
    });
    rerender();

    await act(async () => {
      resolveFetch({
        ok: true,
        json: async () => ({ experience: "modern", colorMode: "light", themeId: "stacks" }),
      });
      await Promise.resolve();
    });
    await flush();

    // The synchronous guard means the mid-fetch re-fire cannot spawn a second
    // concurrent sync, so persistPreference runs at most once.
    expect(mockSetPreference.mock.calls.length).toBeLessThanOrEqual(1);

    vi.unstubAllGlobals();
  });

  it("does not reload on a first load where <html> lacks data-experience (modern default)", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1", appSkin: "modern-stacks-light" } },
    });

    renderHook(() => useThemePreferenceSync());
    await flush();

    // An absent data-experience attribute means SSR painted the default modern
    // experience, which agrees with the resolved modern preference — no reload.
    expect(mockReload).not.toHaveBeenCalled();
  });

  it("lets a mid-sync color-mode toggle win over the resolved preference", async () => {
    mockUseSession.mockReturnValue({ data: { user: { id: "u1" } } });
    let resolveFetch!: (v: unknown) => void;
    const fetchP = new Promise((r) => { resolveFetch = r; });
    vi.stubGlobal("fetch", vi.fn(() => fetchP));

    const { rerender } = renderHook(() => useThemePreferenceSync());

    // User toggles the color mode while the app_state fetch is still in flight.
    setColorScheme("dark");
    rerender();

    await act(async () => {
      // app_state resolves to "dark". The stale closure captured mode="light"
      // at sync start, so the pre-fix `if (mode !== parsed.colorMode)` guard
      // ("light" !== "dark") would fire setMode and stomp the live toggle.
      resolveFetch({
        ok: true,
        json: async () => ({ experience: "modern", colorMode: "dark", themeId: "stacks" }),
      });
      await Promise.resolve();
    });
    await flush();

    // The sync must defer to the user's live toggle and not drive setMode itself.
    expect(mockSetMode).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("applies a late-arriving account appSkin after the first sync, serialized and exactly once", async () => {
    // First sync resolves from local state; the better-auth session (and its
    // authoritative appSkin) arrives only afterwards — the follow-up sync must
    // still apply it rather than dropping it behind the synced guard.
    setLocalPreference("modern-stacks-light");
    mockUseSession.mockReturnValue({ data: { user: { id: "u1" } } });

    let resolveFirstPersist!: () => void;
    mockSetPreference
      .mockReturnValueOnce({
        unwrap: () =>
          new Promise<void>((r) => {
            resolveFirstPersist = () => r(undefined);
          }),
      })
      .mockReturnValue({ unwrap: () => Promise.resolve(undefined) });

    const { rerender } = renderHook(() => useThemePreferenceSync());
    await flush();
    expect(mockSetPreference).toHaveBeenCalledTimes(1);
    expect(mockSetPreference).toHaveBeenCalledWith({
      preference: "modern-stacks-light",
    });

    // The account appSkin resolves while sync #1's persist is still in flight.
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1", appSkin: "modern-bluenote-dark" } },
    });
    rerender();
    await flush();

    // Serialized: the re-sync is queued, never concurrent with sync #1.
    expect(mockSetPreference).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstPersist();
    });
    await flush();

    // The account preference applied exactly once.
    expect(mockSetPreference).toHaveBeenCalledTimes(2);
    expect(mockSetPreference).toHaveBeenLastCalledWith({
      preference: "modern-bluenote-dark",
    });
    expect(mockSetMode).toHaveBeenCalledWith("dark");
    expect(mockSetThemeId).toHaveBeenCalledWith("bluenote");
  });

  it("skips the re-sync when the late account appSkin matches what was already applied", async () => {
    setLocalPreference("modern-stacks-light");
    mockUseSession.mockReturnValue({ data: { user: { id: "u1" } } });

    const { rerender } = renderHook(() => useThemePreferenceSync());
    await flush();
    expect(mockSetPreference).toHaveBeenCalledTimes(1);

    mockUseSession.mockReturnValue({
      data: { user: { id: "u1", appSkin: "modern-stacks-light" } },
    });
    rerender();
    await flush();

    // Already reconciled — no second persist and no reload churn.
    expect(mockSetPreference).toHaveBeenCalledTimes(1);
    expect(mockReload).not.toHaveBeenCalled();
  });
});
