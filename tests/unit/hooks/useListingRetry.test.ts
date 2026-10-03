import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useListingRetry } from "@/src/hooks/useListingRetry";
import { classifyListingFailure } from "@/src/hooks/listingFailureClassification";

type Props = {
  key: unknown;
  isFetching: boolean;
  isError: boolean;
  hasAnyPages: boolean;
};

const IDLE: Props = {
  key: "q",
  isFetching: false,
  isError: false,
  hasAnyPages: true,
};

function setUp(initial: Props = IDLE) {
  const refetch = vi.fn();
  const fetchNextPage = vi.fn();
  const hook = renderHook(
    (props: Props) => useListingRetry({ ...props, refetch, fetchNextPage }),
    { initialProps: initial },
  );
  return { ...hook, refetch, fetchNextPage };
}

describe("useListingRetry routing", () => {
  it.each([
    {
      name: "a first-page failure",
      failure: { isError: true, hasAnyPages: false },
      page: "first",
      called: "refetch",
    },
    {
      name: "a later-page failure",
      failure: { isError: true, hasAnyPages: true },
      page: "later",
      called: "fetchNextPage",
    },
  ] as const)(
    "$name retries through $called and records $page",
    ({ failure, page, called }) => {
      const { result, refetch, fetchNextPage } = setUp({
        ...IDLE,
        ...failure,
      });
      act(() => result.current.retry());

      expect(refetch).toHaveBeenCalledTimes(called === "refetch" ? 1 : 0);
      expect(fetchNextPage).toHaveBeenCalledTimes(
        called === "fetchNextPage" ? 1 : 0,
      );
      expect(result.current.failedPage).toBe(page);
    },
  );

  it("does nothing when nothing has failed", () => {
    const { result, refetch, fetchNextPage } = setUp();
    act(() => result.current.retry());

    expect(refetch).not.toHaveBeenCalled();
    expect(fetchNextPage).not.toHaveBeenCalled();
    expect(result.current.isRetrying).toBe(false);
    expect(result.current.failedPage).toBeNull();
  });
});

describe("useListingRetry hold", () => {
  it("is retrying from the click, and keeps the failure through a render where the error has cleared", () => {
    const { result, rerender } = setUp({
      ...IDLE,
      isError: true,
      hasAnyPages: false,
    });
    act(() => result.current.retry());
    expect(result.current.isRetrying).toBe(true);

    rerender({ ...IDLE, isFetching: true });
    expect(result.current.isRetrying).toBe(true);
    expect(result.current.failedPage).toBe("first");
  });

  it("does not end the retry on a render before fetching has begun", () => {
    const { result, rerender } = setUp({
      ...IDLE,
      isError: true,
      hasAnyPages: true,
    });
    act(() => result.current.retry());

    rerender({ ...IDLE, isError: true, hasAnyPages: true });
    expect(result.current.isRetrying).toBe(true);

    rerender({ ...IDLE, isFetching: true, isError: false, hasAnyPages: true });
    rerender({ ...IDLE, isFetching: false, isError: false, hasAnyPages: true });
    expect(result.current.isRetrying).toBe(false);
  });
});

describe("useListingRetry outcome", () => {
  it("clears the retry and failure when a retried request succeeds", () => {
    const { result, rerender } = setUp({
      ...IDLE,
      isError: true,
      hasAnyPages: false,
    });
    act(() => result.current.retry());
    rerender({ ...IDLE, isFetching: true });
    rerender({ ...IDLE, isFetching: false });

    expect(result.current.isRetrying).toBe(false);
    expect(result.current.failedPage).toBeNull();
    expect(result.current.failedRetries).toBe(0);
  });

  it.each([
    { retries: 1, expected: 1 },
    { retries: 2, expected: 2 },
  ])(
    "counts $retries failed retry(ies) as $expected",
    ({ retries, expected }) => {
      const { result, rerender } = setUp({
        ...IDLE,
        isError: true,
        hasAnyPages: false,
      });
      for (let i = 0; i < retries; i++) {
        act(() => result.current.retry());
        rerender({ ...IDLE, isFetching: true, isError: true, hasAnyPages: false });
        rerender({ ...IDLE, isFetching: false, isError: true, hasAnyPages: false });
      }

      expect(result.current.isRetrying).toBe(false);
      expect(result.current.failedPage).toBe("first");
      expect(result.current.failedRetries).toBe(expected);
    },
  );
});

describe("useListingRetry keys", () => {
  it("drops a retry when the key changes mid-retry", () => {
    const { result, rerender } = setUp({
      ...IDLE,
      isError: true,
      hasAnyPages: false,
    });
    act(() => result.current.retry());
    rerender({ ...IDLE, key: "other", isError: true, hasAnyPages: false });

    expect(result.current.isRetrying).toBe(false);
    expect(result.current.failedPage).toBe("first");
  });

  it("keeps a retry while the same key object is passed on every render", () => {
    const key = { q: "artist:Juana Molina" };
    const { result, rerender } = setUp({
      ...IDLE,
      key,
      isError: true,
      hasAnyPages: true,
    });
    act(() => result.current.retry());
    rerender({ ...IDLE, key, isFetching: true, hasAnyPages: true });

    expect(result.current.isRetrying).toBe(true);
  });
});

describe("useListingRetry classification", () => {
  it.each([
    { isError: false, hasAnyPages: false },
    { isError: false, hasAnyPages: true },
    { isError: true, hasAnyPages: false },
    { isError: true, hasAnyPages: true },
  ])(
    "matches classifyListingFailure for isError=$isError hasAnyPages=$hasAnyPages",
    ({ isError, hasAnyPages }) => {
      const { result } = setUp({ ...IDLE, isError, hasAnyPages });
      expect({
        headFailed: result.current.headFailed,
        nextPageFailed: result.current.nextPageFailed,
      }).toEqual(classifyListingFailure(isError, hasAnyPages));
    },
  );
});
