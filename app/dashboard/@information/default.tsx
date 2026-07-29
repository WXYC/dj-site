// Renders nothing when no album card is open, so parallel-route resolution
// doesn't 404 on unmatched segments in the @information slot (WXYC/dj-site#979).
export default function Default() {
  return null;
}
