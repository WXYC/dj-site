import { adminSlice } from "@/lib/features/admin/frontend";
import { Account, Authorization } from "@/lib/features/admin/types";
import { useAppSelector } from "@/lib/hooks";
import { useAccountListResults } from "@/src/hooks/adminHooks";
import { Button } from "@mui/joy";

const exportDJsAsCSV = (djs: Account[], title = "djs") => {
  let csv = "data:text/csv;charset=utf-8,";
  csv += "Name,Username,DJ Name,Email,Admin\n";
  djs.forEach((dj) => {
    csv += `${dj.realName},${dj.userName},${dj.djName},${dj.email},${
      dj.authorization == Authorization.SM ? "true" : "false"
    }\n`;
  });
  var encodedUri = encodeURI(csv);
  var link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("style", "display: none;");
  link.setAttribute("download", `${title}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function ExportDJsButton() {
  const { data, isLoading } = useAccountListResults();

  const searchString = useAppSelector(adminSlice.selectors.getSearchString);

  return (
    <Button
      loading={isLoading}
      variant="outlined"
      color={"success"}
      size="sm"
      onClick={() => {
        let currentDateTime = new Date();
        let formattedDate = currentDateTime.toISOString().slice(0, 10);
        exportDJsAsCSV(
          data ?? [],
          searchString.length > 0
            ? `wxyc-roster-search-${searchString}-${formattedDate}`
            : `wxyc-roster-${formattedDate}`
        );
      }}
    >
      Export Roster as CSV
    </Button>
  );
}
