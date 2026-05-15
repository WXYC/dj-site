import "@/src/styles/classic/login.css";

export default function Main({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="signon-card">
      <table className="signon-table">
        <thead>
          <tr className="signon-header">
            <th colSpan={2}>
              <span className="title">{title}</span>
            </th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
