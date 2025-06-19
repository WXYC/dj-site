"use client";

import { User } from "@/lib/features/authentication/types";
import { LinkButton } from "@/src/components/General/LinkButton";
import { useAccountListResults } from "@/src/hooks/adminHooks";
import { GppBad } from "@mui/icons-material";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import {
  CircularProgress,
  Sheet,
  Stack,
  Table,
  Tooltip,
  Typography,
} from "@mui/joy";
import { AccountEntry } from "./AccountEntry";
import AccountSearchForm from "./AccountSearchForm";
import ExportDJsButton from "./ExportCSV";

export default function RosterTable({ user }: { user: User }) {
  const { data, isLoading, isError, error } = useAccountListResults();

  return (
    <Sheet
      sx={{
        width: "100%",
        height: "100%",
        overflow: "auto",
        bgcolor: "transparent",
        "--Table-lastColumnWidth": "120px",
      }}
    >
      <Stack
        direction={{ xs: "column", lg: "row" }}
        sx={{ py: 2, justifyContent: "space-between" }}
      >
        <AccountSearchForm />
        <Stack
          direction="row"
          spacing={1}
          sx={{
            mt: {
              xs: 2,
              lg: 0,
            },
          }}
        >
          <ExportDJsButton />
          <LinkButton
            variant="solid"
            color={"success"}
            size="sm"
            href="/dashboard/admin/roster/add"
          >
            Add DJs
          </LinkButton>
        </Stack>
      </Stack>
      <Table
        stripe="odd"
        sx={{
          fontWeight: "sm",
          textAlign: "left",
          "& tr > *:last-child": {
            position: "sticky",
            right: 0,
          },
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                width: 55,
                verticalAlign: "center",
                textAlign: "center",
              }}
            >
              <Tooltip
                title="Toggle Admin Status"
                arrow={true}
                placement="top"
                variant="outlined"
                size="sm"
              >
                <AdminPanelSettingsIcon />
              </Tooltip>
            </th>
            <th style={{ minWidth: "100px" }}>Name</th>
            <th style={{ minWidth: "100px" }}>Username</th>
            <th style={{ minWidth: "100px" }}>DJ Name</th>
            <th style={{ minWidth: "100px" }}>Email</th>
            <th
              aria-label="last"
              style={{ width: "var(--Table-lastColumnWidth)" }}
            />
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr style={{ background: "transparent" }}>
              <td
                colSpan={6}
                style={{ textAlign: "center", paddingTop: "2rem" }}
              >
                <CircularProgress color={"success"} />
              </td>
            </tr>
          ) : isError ? (
            <tr style={{ background: "transparent" }}>
              <td
                colSpan={6}
                style={{ textAlign: "center", paddingTop: "2rem" }}
              >
                <GppBad color="error" sx={{ fontSize: "5rem" }} />
                <Typography level="body-md" sx={{ pb: 2 }}>
                  Something has gone wrong with the admin panel. Please try
                  again later.
                </Typography>
                <Typography level="body-sm">{String(error)}</Typography>
              </td>
            </tr>
          ) : (
            data.map((dj) => (
              <AccountEntry
                key={`roster-entry-${dj.userName}`}
                account={dj}
                isSelf={dj.userName === user.username}
              />
            ))
          )}
        </tbody>
      </Table>
    </Sheet>
  );
}
