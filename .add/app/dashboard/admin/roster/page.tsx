'use client';

import { useEffect, useState } from "react";

import { AddDJsPopup } from "@/app/components/Admin/Popups/AddDJsPopup";
import DJEntry from "@/app/components/Admin/Roster/DJEntry";
import { DJ, applicationSlice, fetchDJs, getAdminError, getAdminLoading, getAuthenticatedUser, getDJs, useDispatch, useSelector } from "@/lib/redux";
import exportDJsAsCSV from "@/lib/utilities/admin/dj-csv-export";
import { GppBad } from "@mui/icons-material";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import CloseIcon from '@mui/icons-material/Close';
import TroubleshootIcon from '@mui/icons-material/Troubleshoot';
import {
  Button,
  CircularProgress,
  FormControl,
  Input,
  Sheet,
  Stack,
  Table,
  Tooltip,
  Typography
} from "@mui/joy";

/**
 * Represents a DJ roster component for managing djs and their profiles.
 *
 * @component
 * @category Station Management
 *
 *
 * @returns {JSX.Element} The DJRoster component.
 */
const DJRoster = (): JSX.Element => {

  const dispatch = useDispatch();

  const openPopup = (content: JSX.Element) => dispatch(applicationSlice.actions.openPopup(content));

  const user = useSelector(getAuthenticatedUser);

  const loading = useSelector(getAdminLoading);
  const error = useSelector(getAdminError);

  const djs = useSelector(getDJs);
  
  const [results, setResults] = useState<DJ[]>([]);
  const [searchString, setSearchString] = useState("");

  useEffect(() => {
    dispatch(fetchDJs()).then(() => {
      dispatch(populateSta());
    });
  }, [dispatch]);

  useEffect(() => {
    if (searchString.length === 0) {
      setResults(djs);
    } else {
      setResults(
        djs.filter(
          (dj) =>
            dj.realName.toLowerCase().includes(searchString.toLowerCase()) ||
            dj.userName.toLowerCase().includes(searchString.toLowerCase()) ||
            dj.djName.toLowerCase().includes(searchString.toLowerCase())
        )
      );
    }
  }, [searchString, djs]);

  return (
    <Sheet
        sx = {{
            width: '100%',
            height: '100%',
            overflow: 'auto',
            bgcolor: 'transparent',
          "--Table-lastColumnWidth": "120px",
        }}
    >
      <Stack direction={{ xs: "column", lg: "row" }} sx={{ py: 2, justifyContent: 'space-between' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <FormControl>
            <Input 
              color = {"success"}
              size="sm" 
              sx={{ minWidth: '400px' }} 
              placeholder="Search Roster"
              startDecorator = {<TroubleshootIcon />}
              endDecorator = {
                (searchString.length > 0) && (
                  <Button
                  variant="plain"
                  color = {"success"}
                  size="sm"
                  onClick={() => { setSearchString(""); }}
                  sx = {{
                    px: 0.5,
                  }}
                >
                  <CloseIcon />
                </Button>
                )
              }
              value={searchString}
              onChange={(e) => { setSearchString(e.target.value); }}
            />
          </FormControl>
        </form>
      <Stack direction="row" spacing={1}
        sx = {{
          mt: {
            xs: 2,
            lg: 0,
          }
        }}
      >
        <Button
          variant="outlined"
          color={"success"}
          size="sm"
          onClick={() => {
            let currentDateTime = new Date();
            let formattedDate = currentDateTime.toISOString().slice(0, 10);
            exportDJsAsCSV(results, searchString.length > 0 ? `wxyc-roster-search-${searchString}-${formattedDate}` : `wxyc-roster-${formattedDate}`);
          }}
        >
          Export Roster as CSV
        </Button>
        <Button variant="solid" color={"success"} size="sm"
          onClick = {() => { openPopup(<AddDJsPopup />); }}
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
            <th
              style={{
                width: 48,
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
            <th style = {{ minWidth: '100px' }}>Name</th>
            <th style = {{ minWidth: '100px' }}>Username</th>
            <th style = {{ minWidth: '100px' }}>DJ Name</th>
            <th style = {{ minWidth: '100px' }}>Shows</th>
            <th
              aria-label="last"
              style={{ width: "var(--Table-lastColumnWidth)" }}
            />
          </tr>
        </thead>
        <tbody>
          {(loading) ? (
            <tr
              style={{ background: 'transparent' }}
            >
            <td colSpan={6} style={{ textAlign: "center", paddingTop: '2rem' }}>
              <CircularProgress color={"success" } />
            </td>
            </tr>
          ) : ((error) ? (
            <tr
              style={{ background: 'transparent' }}
            >
            <td colSpan={6} style={{ textAlign: "center", paddingTop: '2rem' }}>
              <GppBad color="error" sx = {{ fontSize: '5rem' }} />
              <Typography level="body-md" sx = {{ pb: 2 }}>
                Something has gone wrong with the admin panel. Please try again later.
              </Typography>
              <Typography level="body-sm">
                {error}
              </Typography>
            </td>
            </tr>
          ) : (results.map((dj) => (
            <DJEntry
              key={dj.userName}
              dj={dj}
              isSelf={dj.userName === user?.username}
            />
          ))))}
        </tbody>
      </Table>
    </Sheet>
  );
};

export default DJRoster;