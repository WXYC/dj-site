export function MatchHighlight({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const q = query.trim().toLowerCase();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  if (lower.startsWith(q)) {
    return (
      <>
        {text.slice(0, q.length)}
        <b>{text.slice(q.length)}</b>
      </>
    );
  }
  const at = lower.indexOf(q);
  if (at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <b>{text.slice(at, at + q.length)}</b>
      {text.slice(at + q.length)}
    </>
  );
}
