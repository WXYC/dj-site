import { adminSlice } from "@/lib/features/admin/frontend";
import { Account, Authorization } from "@/lib/features/admin/types";
import { useAppSelector } from "@/lib/hooks";
import { useAccountListResults } from "@/src/hooks/adminHooks";
import { Button } from "@mui/joy";

const FORMULA_PREFIXES = ["=", "+", "-", "@"];

export function escapeCSVField(field: string): string {
  if (!field) return field;

  let escaped = field;

  if (FORMULA_PREFIXES.some((prefix) => escaped.startsWith(prefix))) {
    escaped = `'${escaped}`;
  }

  if (
    escaped.includes(",") ||
    escaped.includes('"') ||
    escaped.includes("\n")
  ) {
    escaped = `"${escaped.replace(/"/g, '""')}"`;
  }

  return escaped;
}

export function buildCSVContent(djs: Account[]): string {
  let csv = "Name,Username,DJ Name,Email,Admin\n";
  djs.forEach((dj) => {
    const fields = [
      escapeCSVField(dj.realName),
      escapeCSVField(dj.userName),
      escapeCSVField(dj.djName),
      escapeCSVField(dj.email ?? ""),
      dj.authorization == Authorization.SM ? "true" : "false",
    ];
    csv += fields.join(",") + "\n";
  });
  return csv;
}

const exportDJsAsCSV = (djs: Account[], title = "djs") => {
  const csv = buildCSVContent(djs);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("style", "display: none;");
  link.setAttribute("download", `${title}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
        const currentDateTime = new Date();
        const formattedDate = currentDateTime.toISOString().slice(0, 10);
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
