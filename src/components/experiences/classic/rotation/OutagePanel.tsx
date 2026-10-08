/** A query-fed list must never render an unissued or failed request as "there are none". */
export default function OutagePanel({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <p role="alert" className="artist-error-message" style={{ textAlign: "center" }}>
      Rotation releases are unavailable right now.{" "}
      <button type="button" disabled={retrying} onClick={onRetry}>
        Try again
      </button>
    </p>
  );
}
