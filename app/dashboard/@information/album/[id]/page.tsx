// Non-intercepted fallback in the @information slot: renders the same modal on
// hard navigation / direct permalink load. See the (.)album/[id] sibling and
// WXYC/dj-site#979.
// Allowed to block: the root layout resolves the session before this renders,
// so nothing below it can prerender until that read moves behind Suspense.
export const instant = false;

export { default } from "../../(.)album/[id]/page";
