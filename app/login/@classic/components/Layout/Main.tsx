export default function Main({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <table cellPadding={10}>
      <tbody>
        <tr>
          <td align="center" valign="top">
            <span className="title">{title}</span>
            <br />
          </td>
        </tr>
        <tr>
          <td align="center">{children}</td>
        </tr>
      </tbody>
    </table>
  );
}
