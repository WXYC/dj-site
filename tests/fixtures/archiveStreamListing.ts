import type { ArchiveStreamListing } from "@/src/hooks/archiveStreamHooks";

/**
 * A listing with nothing loaded and nothing failed, for specs that render the
 * archive table or its status states from hand-picked flags. Typed as
 * `ArchiveStreamListing`, so a field the hook gains fails type-checking here
 * until the default is written.
 */
export function createTestArchiveStreamListing(
  overrides: Partial<ArchiveStreamListing> = {},
): ArchiveStreamListing {
  return {
    rows: [],
    isHeadLoading: false,
    isNextPageLoading: false,
    headFailed: false,
    nextPageFailed: false,
    failedPage: null,
    isRetrying: false,
    failedRetries: 0,
    hasMore: false,
    loadNextPage: () => {},
    retry: () => {},
    hasAnswered: true,
    ...overrides,
  };
}
