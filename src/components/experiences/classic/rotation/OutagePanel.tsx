/** A query-fed list must never render an unissued or failed request as "there are none". */
export default function OutagePanel({ message, onRetry, retrying }: { message: string; onRetry: () => void; retrying: boolean }) {
  return (
    <p role="alert" className="artist-error-message" style={{ textAlign: "center" }}>
      {message}{" "}
      <button type="button" disabled={retrying} onClick={onRetry}>
        Try again
      </button>
    </p>
  );
}
