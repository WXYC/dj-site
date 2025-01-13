"use client";

import { useEffect, useState } from "react";

import { AddDJsPopup } from "@/app/components/General/Admin/Popups/AddDJsPopup";
import DJEntry from "@/app/components/General/Admin/Roster/DJEntry";
import { ConfirmPopup } from "@/app/components/General/Popups/Confirm";
import useAuthUser from "@/app/hooks/use-auth-user";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  Authority,
  demote,
  fetchDJs,
  populateAdmins,
  promote,
  removeDJ,
  User,
} from "@/lib/models";
import {
  getAdminError,
  getAdminLoading,
  getDJPromotions,
  getDJs,
} from "@/lib/slices/admin/selectors";
import { applicationSlice } from "@/lib/slices/application/slice";
import { exportDJsAsCSV } from "@/utils/admin/dj-csv-export";
import { getPromotionMessage } from "@/utils/admin/get-promotion-message";
import { GppBad } from "@mui/icons-material";
import CloseIcon from "@mui/icons-material/Close";
import TroubleshootIcon from "@mui/icons-material/Troubleshoot";
import {
  Button,
  CircularProgress,
  FormControl,
  Input,
  Sheet,
  Stack,
  Table,
  Typography,
} from "@mui/joy";

export const ModernDJRosterPage = (): JSX.Element => {
  const dispatch = useAppDispatch();

  const openPopup = (uniqueId: string) =>
    dispatch(applicationSlice.actions.openPopup(uniqueId));

  const appointAdmin = (dj: User, authority: Authority) => {
    dispatch(promote({ dj, authority })).then(() => {
      dispatch(populateAdmins());
    });
  };
  const demoteAdmin = (dj: User) => {
    dispatch(demote(dj)).then(() => {
      dispatch(populateAdmins());
    });
  };

  const user = useAuthUser();

  const loading = useAppSelector(getAdminLoading);
  const error = useAppSelector(getAdminError);

  const djs = useAppSelector(getDJs);
  const djPromotions = useAppSelector(getDJPromotions);

  const [results, setResults] = useState<User[]>([]);
  const [searchString, setSearchString] = useState("");

  useEffect(() => {
    dispatch(fetchDJs()).then(() => {
      dispatch(populateAdmins());
    });
  }, [dispatch]);

  useEffect(() => {
    if (searchString.length === 0) {
      setResults(djs);
    } else {
      setResults(
        djs.filter(
          (dj) =>
            dj.name!.toLowerCase().includes(searchString.toLowerCase()) ||
            dj.username!.toLowerCase().includes(searchString.toLowerCase()) ||
            dj.djName!.toLowerCase().includes(searchString.toLowerCase())
        )
      );
    }
  }, [searchString, djs]);

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
      <AddDJsPopup uniqueId="add-djs" />
      <Stack
        direction={{ xs: "column", lg: "row" }}
        sx={{ py: 2, justifyContent: "space-between" }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <FormControl>
            <Input
              color={"success"}
              size="sm"
              sx={{ minWidth: "400px" }}
              placeholder="Search Roster"
              startDecorator={<TroubleshootIcon />}
              endDecorator={
                searchString.length > 0 && (
                  <Button
                    variant="plain"
                    color={"success"}
                    size="sm"
                    onClick={() => {
                      setSearchString("");
                    }}
                    sx={{
                      px: 0.5,
                    }}
                  >
                    <CloseIcon />
                  </Button>
                )
              }
              value={searchString}
              onChange={(e) => {
                setSearchString(e.target.value);
              }}
            />
          </FormControl>
        </form>
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
          <Button
            variant="outlined"
            color={"success"}
            size="sm"
            onClick={() => {
              let currentDateTime = new Date();
              let formattedDate = currentDateTime.toISOString().slice(0, 10);
              exportDJsAsCSV(
                results,
                searchString.length > 0
                  ? `wxyc-roster-search-${searchString}-${formattedDate}`
                  : `wxyc-roster-${formattedDate}`
              );
            }}
          >
            Export Roster as CSV
          </Button>
          <Button
            variant="solid"
            color={"success"}
            size="sm"
            onClick={() => openPopup("add-djs")}
          >
            Add DJs
          </Button>
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
            <th style={{ width: "100px" }}>Permissions</th>
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
          {results.map((dj: User) => {
            const newAuthority = djPromotions[dj.username];
            const confirmMessage = getPromotionMessage(dj, newAuthority);

            return (
              <>
                <ConfirmPopup
                  key={`permissions-${dj.username}`}
                  style={"success"}
                  uniqueId={`permissions-${dj.username}`}
                  message={confirmMessage}
                  onConfirm={() => {
                    if (newAuthority === dj.authority) return;

                    demoteAdmin(dj);
                    appointAdmin(dj, newAuthority);
                  }}
                />
                <ConfirmPopup
                  key={`delete-${dj.username}`}
                  style={"danger"}
                  uniqueId={`delete-${dj.username}`}
                  message={`Are you sure you want to delete ${dj.name ??
                    dj.djName ??
                    dj.username}'s account (@${dj.username})?`}
                  onConfirm={() =>
                    dispatch(removeDJ(dj)).then(() => {
                      dispatch(fetchDJs()).then(() => {
                        dispatch(populateAdmins());
                      });
                    })
                  }
                />
              </>
            );
          })}
          {loading ? (
            <tr style={{ background: "transparent" }}>
              <td
                colSpan={6}
                style={{ textAlign: "center", paddingTop: "2rem" }}
              >
                <CircularProgress color={"success"} />
              </td>
            </tr>
          ) : error ? (
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
                <Typography level="body-sm">{error}</Typography>
              </td>
            </tr>
          ) : (
            results.map((dj) => (
              <DJEntry
                key={dj.username}
                dj={dj}
                isSelf={dj.username === user?.username}
              />
            ))
          )}
        </tbody>
      </Table>
    </Sheet>
  );
};
