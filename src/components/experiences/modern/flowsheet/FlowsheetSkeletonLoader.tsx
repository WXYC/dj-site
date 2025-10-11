import { Stack } from "@mui/joy";
import SkeletonEntry from "./Entries/SkeletonEntry";


export default function FlowsheetSkeletonLoader({ count } : { count: number }) {
    return (
        <Stack direction="column" spacing={1}>
        {[...Array(count)].map((_, index) => (
            <SkeletonEntry key={`skeleton-entry-loader-${index}`} />
        ))}
      </Stack>
    )
}