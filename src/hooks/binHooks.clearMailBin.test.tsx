import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { makeStore } from "@/lib/store";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import { BIN_CLEAR_CONFIRM_THRESHOLD, useClearMailBin } from "./binHooks";
import { toast } from "sonner";

const mockClearBin = vi.fn();
let mockBin: AlbumEntry[] | undefined = [];

const mockUseRegistry = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    warning: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("./authenticationHooks", () => ({
  useRegistry: () => mockUseRegistry(),
}));

vi.mock("@/lib/features/bin/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/bin/api")>();
  return {
    ...actual,
    useGetBinQuery: vi.fn(() => ({
      data: mockBin,
      isLoading: false,
      isSuccess: true,
      isError: false,
    })),
    useClearBinMutation: vi.fn(() => [mockClearBin, { isLoading: false }]),
  };
});

function createWrapper() {
  const store = makeStore();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };
}

function makeAlbumEntry(id: number): AlbumEntry {
  return {
    id,
    title: `Album ${id}`,
    entry: 1,
    format: "CD",
    artist: {
      id,
      name: "Artist",
      lettercode: "AR",
      numbercode: 1,
      genre: "Rock",
    },
    label: "Label",
    add_date: "2024-01-01",
    alternate_artist: "",
  };
}

describe("useClearMailBin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRegistry.mockReturnValue({
      loading: false,
      info: { id: "dj-1" },
    });
    mockClearBin.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("clears immediately when bin has at most threshold items", async () => {
    mockBin = Array.from({ length: BIN_CLEAR_CONFIRM_THRESHOLD }, (_, i) =>
      makeAlbumEntry(i + 1),
    );

    const { result } = renderHook(() => useClearMailBin(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.requestClear();
    });

    expect(toast.warning).not.toHaveBeenCalled();
    expect(mockClearBin).toHaveBeenCalledWith({ dj_id: "dj-1" });
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows sonner confirmation when bin has more than threshold items", () => {
    mockBin = Array.from(
      { length: BIN_CLEAR_CONFIRM_THRESHOLD + 1 },
      (_, i) => makeAlbumEntry(i + 1),
    );

    const { result } = renderHook(() => useClearMailBin(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.requestClear();
    });

    expect(toast.warning).toHaveBeenCalledWith(
      `Remove all ${BIN_CLEAR_CONFIRM_THRESHOLD + 1} items from your mail bin?`,
      expect.objectContaining({
        action: expect.objectContaining({ label: "Clear bin" }),
        cancel: expect.objectContaining({ label: "Cancel" }),
      }),
    );
    expect(mockClearBin).not.toHaveBeenCalled();
  });

  it("does not clear when bin is empty", () => {
    mockBin = [];

    const { result } = renderHook(() => useClearMailBin(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.requestClear();
    });

    expect(toast.warning).not.toHaveBeenCalled();
    expect(mockClearBin).not.toHaveBeenCalled();
  });
});
