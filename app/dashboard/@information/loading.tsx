// Renders nothing while a segment in the @information slot loads. This slot's
// resolved content is a portaled modal (out of flow); the dashboard-level
// loading fallback is an in-flow block, and because this slot renders as a
// sibling ABOVE the experience container, that block would shove the entire
// dashboard frame down for the duration of every album navigation. The album
// popup carries its own loading card for the data-fetch phase.
export default function Loading() {
  return null;
}
