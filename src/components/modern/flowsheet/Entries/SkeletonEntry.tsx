import { Skeleton } from "@mui/joy";

export default function SkeletonEntry() {
  return <Skeleton animation="wave" variant="rectangular" sx={{ height: 60, borderRadius: "md" }} />;
}
