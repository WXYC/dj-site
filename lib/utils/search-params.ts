// A repeated query key (?token=a&token=b) reaches a page's `searchParams` as
// string[]; useSearchParams().get() returned only the first value, so server
// pages reading the same params must match that to keep single-string
// contracts (e.g. AuthLinkSessionGuard's linkToken) intact.
export function firstSearchParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
