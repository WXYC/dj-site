// loading.js does not wrap this segment's own layout.tsx (the requireAuth()
// await lives there), only page.js/nested layout.js below it — see
// node_modules/next/dist/docs/.../loading.md. This fallback still covers
// navigation into the @modern/@classic slot trees below the dashboard layout.
export { LoadingFallback as default } from "@/src/components/LoadingFallback";
