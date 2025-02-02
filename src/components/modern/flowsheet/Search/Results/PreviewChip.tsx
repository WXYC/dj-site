import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { FlowsheetQuery } from "@/lib/features/flowsheet/types";
import { useAppSelector } from "@/lib/hooks";
import { Chip, Typography } from "@mui/joy";

export default function PreviewChip({
  label,
  name,
}: {
  label: string;
  name: keyof FlowsheetQuery;
}) {
  const searchQuery = useAppSelector(flowsheetSlice.selectors.getSearchQuery);

  if (searchQuery[name] === "") {
    return <div></div>;
  }

  return (
    <Chip sx={{ my: 0.5 }}>
      <Typography level="body-sm" textColor={"text.primary"}>
        {label}: {searchQuery[name]}
      </Typography>
    </Chip>
  );
}
