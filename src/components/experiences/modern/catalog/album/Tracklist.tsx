import { Table, Typography } from "@mui/joy";

interface TracklistProps {
  tracklist: { position: string; title: string; duration: string }[] | undefined;
}

export default function Tracklist({ tracklist }: TracklistProps) {
  if (!tracklist || tracklist.length === 0) {
    return (
      <Typography
        level="body-sm"
        sx={{ color: "text.tertiary", fontStyle: "italic" }}
      >
        No tracklist available
      </Typography>
    );
  }

  return (
    <Table size="sm" stripe="odd">
      <thead>
        <tr>
          <th style={{ width: 40 }}>#</th>
          <th>Title</th>
          <th style={{ width: 80 }}>Duration</th>
        </tr>
      </thead>
      <tbody>
        {tracklist.map((track, index) => (
          <tr key={index}>
            <td>{track.position}</td>
            <td>{track.title}</td>
            <td>{track.duration}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
