"use client";

import { useEffect, useState } from "react";

import { AddDJsPopup } from "@/app/components/General/Admin/Popups/AddDJsPopup";
import useAuthUser from "@/app/hooks/use-auth-user";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  Authority,
  demote,
  fetchDJs,
  populateAdmins,
  promote,
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
import { DeleteForever, GppBad } from "@mui/icons-material";
import CloseIcon from "@mui/icons-material/Close";
import TroubleshootIcon from "@mui/icons-material/Troubleshoot";
import {
  Button,
  FormControl,
  Input,
  Radio,
  RadioGroup,
  Sheet,
  Stack,
  Table,
  Typography,
} from "@mui/joy";

export const ClassicDJRosterPage = (): JSX.Element => {
  const dispatch = useAppDispatch();

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
        px: 20,
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
            <input type="text" style={{ minWidth: "400px" }} />
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
            <th style={{ width: "120px" }}>
              DJ&nbsp;&nbsp;&nbsp;MD&nbsp;&nbsp;&nbsp;SM
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
          {loading ? (
            <tr style={{ background: "transparent" }}>
              <td
                colSpan={6}
                style={{ textAlign: "center", paddingTop: "2rem" }}
              >
                Loading...
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
              <tr>
                <td
                  style={{
                    verticalAlign: "center",
                    textAlign: "center",
                  }}
                >
                  <RadioGroup
                    value={dj.authority}
                    onChange={() => {}}
                    orientation="horizontal"
                  >
                    {[Authority.DJ, Authority.MD, Authority.SM].map(
                      (authority) => (
                        <Radio
                          overlay
                          color="neutral"
                          title={(() => {
                            if (dj.username === user?.username)
                              return "You cannot change your own permissions!";

                            switch (authority) {
                              case Authority.DJ:
                                return "DJ";
                              case Authority.MD:
                                return "Music Director";
                              case Authority.SM:
                                return "Station Manager";
                            }
                          })()}
                          value={authority}
                          disabled={dj.username === user?.username}
                        />
                      )
                    )}
                  </RadioGroup>
                </td>
                <td>{dj.name}</td>
                <td>{dj.username}</td>
                <td>
                  {(dj.djName?.length ?? 0 > 0) && "DJ"} {dj.djName}
                </td>
                <td>{dj.email}</td>
                <td>
                  <Stack direction="row" spacing={0.5}>
                    <button
                      disabled={dj.username === user?.username}
                      onClick={() => {}}
                      title={
                        dj.username !== user?.username
                          ? `Delete ${dj.name}${
                              dj.name?.length ?? 0 > 0 ? "'s" : ""
                            } Profile`
                          : `You cannot delete yourself!`
                      }
                    >
                      <DeleteForever />
                    </button>
                  </Stack>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </Sheet>
  );
};
