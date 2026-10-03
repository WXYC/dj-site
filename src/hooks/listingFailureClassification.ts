export type ListingFailure = {
  headFailed: boolean;
  nextPageFailed: boolean;
};

/**
 * The two listings on the Previous Sets screen share this, so they never
 * classify one failure differently. `hasAnyPages` means pages held for the
 * key that failed: none means its first page failed, some means a later one
 * did.
 */
export function classifyListingFailure(
  isError: boolean,
  hasAnyPages: boolean,
): ListingFailure {
  return {
    headFailed: isError && !hasAnyPages,
    nextPageFailed: isError && hasAnyPages,
  };
}
