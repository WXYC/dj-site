import { vi } from "vitest";
import { createTestAlbum } from "../fixtures";

/** Creates mock implementations for bin API hooks. */
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

/** Creates mock for useAddToBin hook. */
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

/** Creates mock for useDeleteFromBin hook. */
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
