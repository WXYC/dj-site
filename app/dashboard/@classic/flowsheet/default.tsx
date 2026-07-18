// A hard load of /dashboard/flowsheet/album/[id] leaves this slot unmatched at
// the album segment; without a default here the whole page 404s. Classic has
// no album card, so it keeps showing the flowsheet.
export { default } from "./page";
