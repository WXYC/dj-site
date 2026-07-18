// A hard load of /dashboard/catalog/album/[id] leaves this slot unmatched at
// the album segment; without a default here the whole page 404s. Classic has
// no album card, so it keeps showing the catalog.
export { default } from "./page";
