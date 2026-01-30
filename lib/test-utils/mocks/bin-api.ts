import { vi } from "vitest";
import { createTestAlbum } from "../fixtures";

/**
 * Creates mock implementations for bin API hooks.
 *
 * NOTE: Due to vi.mock hoisting, these factory functions cannot be called
 * directly inside vi.mock(). Use createTestAlbum() to create mock data
 * outside vi.mock, then reference it in the mock factory.
 *
 * @example
 * const mockBinData = [
 *   createTestAlbum({ id: 1, title: "Test Album" }),
 *   createTestAlbum({ id: 2, title: "Another Album" }),
 * ];
 *
 * vi.mock("@/lib/features/bin/api", async (importOriginal) => {
 *   const actual = await importOriginal<typeof import("@/lib/features/bin/api")>();
 *   return {
 *     ...actual,
 *     useGetBinQuery: vi.fn(() => ({ data: mockBinData, isLoading: false, isSuccess: true })),
 *   };
 * });
 */
export function createBinApiMocks(options: {
  binData?: ReturnType<typeof createTestAlbum>[];
  isLoading?: boolean;
  isError?: boolean;
} = {}) {
  const {
    binData = [
      createTestAlbum({ id: 1, title: "Test Album" }),
      createTestAlbum({ id: 2, title: "Another Album" }),
    ],
    isLoading = false,
    isError = false,
  } = options;

  const mockDeleteFromBin = vi.fn();
  const mockAddToBin = vi.fn();

  return {
    useGetBinQuery: vi.fn(() => ({
      data: binData,
      isLoading,
      isSuccess: !isLoading && !isError,
      isError,
    })),
    useDeleteFromBinMutation: vi.fn(() => [
      mockDeleteFromBin,
      { isLoading: false, isError: false },
    ]),
    useAddToBinMutation: vi.fn(() => [
      mockAddToBin,
      { isLoading: false, isError: false },
    ]),
    // Expose mock functions for assertions
    _mocks: {
      deleteFromBin: mockDeleteFromBin,
      addToBin: mockAddToBin,
    },
  };
}

/**
 * Creates mock for useAddToBin hook.
 *
 * @example
 * const { mock, hookReturn } = createAddToBinMock();
 * vi.mock("@/src/hooks/binHooks", () => ({
 *   useAddToBin: () => hookReturn,
 * }));
 *
 * // In test:
 * expect(mock).toHaveBeenCalledWith(albumId);
 */
export function createAddToBinMock(loading = false) {
  const mock = vi.fn();
  return {
    mock,
    hookReturn: {
      addToBin: mock,
      loading,
    },
  };
}

/**
 * Creates mock for useDeleteFromBin hook.
 *
 * @example
 * const { mock, hookReturn } = createDeleteFromBinMock();
 * vi.mock("@/src/hooks/binHooks", () => ({
 *   useDeleteFromBin: () => hookReturn,
 * }));
 */
export function createDeleteFromBinMock(loading = false) {
  const mock = vi.fn();
  return {
    mock,
    hookReturn: {
      deleteFromBin: mock,
      loading,
    },
  };
}
