import React, { useContext, useEffect, useState } from "react";

import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import CloseIcon from '@mui/icons-material/Close';
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import ManageHistoryIcon from "@mui/icons-material/ManageHistory";
import SyncLockIcon from "@mui/icons-material/SyncLock";
import TroubleshootIcon from '@mui/icons-material/Troubleshoot';
import {
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  IconButton,
  Input,
  Sheet,
  Stack,
  Table,
  Tooltip
} from "@mui/joy";
import { PopupContentContext } from "../../../pages/dashboard/Popup";
import { useAuth } from "../../../services/authentication/authentication-context";
import { deleteUser, listUsers, makeAdmin, removeAdmin } from "../../../services/station-management/admin-service";
import { ConfirmPopup } from "../../general/popups/general-popups";
import exportDjsAsCSV from "../csv-export";
import { AddDJsPopup } from "../popups/add-djs";
import { ResetPasswordPopup } from "../popups/reset-password";

/**
 * Represents a DJ roster component for managing djs and their profiles.
 *
 * @component
 * @category Station Management
 *
 * @param {Object} props - The component props.
 * @param {string} [props.props.style] - The color props.style for the component.
 *
 * @returns {JSX.Element} The DJRoster component.
 */
const DJRoster = (props) => {

  const { openPopup, closePopup } = useContext(PopupContentContext);

  const { user } = useAuth();
  
  const [results, setResults] = useState([]);
  const [searchString, setSearchString] = useState("");

  useEffect(() => {
    if (searchString.length === 0) {
      setResults(props.roster);
    } else {
      setResults(
        props.roster.filter(
          (dj) =>
            dj.name.toLowerCase().includes(searchString.toLowerCase()) ||
            dj.username.toLowerCase().includes(searchString.toLowerCase()) ||
            dj.djName.toLowerCase().includes(searchString.toLowerCase())
        )
      );
    }
  }, [searchString, props.roster]);

  const DJEntry = ({ name, username, djname, shows, isAdmin, isSelf }) => {

    const handleDeleteDJ = () => {
      openPopup(
        <ConfirmPopup
          message={`Are you sure you want to delete ${((name?.length > 0) ? name : null) ?? username ?? 'this account'}?`}
          onConfirm={() => {
            (async () => {
              props.setLoading(true);
              await deleteUser(username);
              props.setDjs(await listUsers());
              props.setLoading(false);
            })();
          }}
        />
      );
    };

    const handleChangeAdmin = () => {
        openPopup(
          <ConfirmPopup
            message={(isAdmin) ? 
              `Are you sure you want to remove admin privileges for ${((name?.length > 0) ? name : null) ?? username ?? 'this account'}?` : 
              `Are you sure you want to grant admin privileges for ${((name?.length > 0) ? name : null) ?? username ?? 'this account'}?`}
            onConfirm={() => { ((isAdmin) ? removeAdmin(username) : makeAdmin(username)).then(() => props.updateDjs()) }}
          />
        )
    };

    return (
      <tr>
        <td
          style={{
            verticalAlign: "center",
            textAlign: "center",
          }}
        >
          <Checkbox
            disabled = {isSelf}
            color={props.style ?? "success"}
            sx={{ transform: "translateY(3px)" }}
            checked={isAdmin}
            onChange={handleChangeAdmin}
          />
        </td>
        <td>{name}</td>
        <td>{username}</td>
        <td>{(djname.length > 0) && 'DJ'} {djname}</td>
        <td>{shows}</td>
        <td>
          <Stack direction="row" spacing={0.5}>
            <Tooltip
              title={`Manage ${name}${(name.length > 0)? "'s" : ''} Schedule`}
              arrow={true}
              placement="top"
              variant="outlined"
                size="sm"
            >
              <IconButton color={props.style ?? "success"} variant="solid" size="sm">
                <ManageHistoryIcon />
              </IconButton>
            </Tooltip>
            <Tooltip
              title={`Reset ${name}${(name.length > 0)? "'s" : ''} Password`}
              arrow={true}
              placement="top"
              variant="outlined"
              size="sm"
            >
              <IconButton color={props.style ?? "success"} variant="solid" size="sm"
                onClick={() => {
                  openPopup(
                    <ResetPasswordPopup username={username} />
                  )
                }}
              >
                <SyncLockIcon />
              </IconButton>
            </Tooltip>
            <Tooltip
              title={(!isSelf) ? `Delete ${name}${(name.length > 0)? "'s" : ''} Profile` : `You cannot delete yourself!`}
              arrow={true}
              placement="top"
              variant="outlined"
              size='sm'
            >
              <IconButton color="warning" variant="outlined" size="sm"
                disabled = {isSelf}
                onClick={handleDeleteDJ}
              >
                <DeleteForeverIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </td>
      </tr>
    );
  };

  return (
    <Sheet
        overflow="auto"
        sx = {{
            width: '100%',
            height: '100%',
            
          "--Table-lastColumnWidth": "120px",
        }}
    >
      <Stack direction={{ xs: "column", lg: "row" }} sx={{ p: 2, justifyContent: 'space-between' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <FormControl>
            <Input 
              color = {props.style ?? "success"}
              size="sm" 
              sx={{ minWidth: '400px' }} 
              placeholder="Search props.roster"
              startDecorator = {<TroubleshootIcon />}
              endDecorator = {
                (searchString.length > 0) && (
                  <Button
                  variant="plain"
                  color = {props.style ?? "success"}
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
          color={props.style ?? "success"}
          size="sm"
          onClick={() => {
            exportDjsAsCSV(results, searchString.length > 0 ? `props.roster-search-${searchString}` : "props.roster");
          }}
        >
          Export Roster as CSV
        </Button>
        <Button variant="solid" color={props.style ?? "success"} size="sm"
          onClick = {() => { openPopup(<AddDJsPopup style={props.style} callback={async () => { props.setDjs(await listUsers()); }} />); }}
        >
          Add djs
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
          {(props.loading) ? (
            <tr
              style={{ background: 'transparent' }}
            >
            <td colSpan={6} style={{ textAlign: "center", paddingTop: '2rem' }}>
              <CircularProgress color={props.style ?? "success" } />
            </td>
            </tr>
          ) : (results.map((dj) => (
            <DJEntry
              key={dj.username}
              name={dj.name}
              username={dj.username}
              djname={dj.djName}
              shows={dj.shows || 'Not Scheduled'}
              isAdmin={dj.isAdmin}
              isSelf={dj.username === user.Username}
            />
          )))}
        </tbody>
      </Table>
    </Sheet>
  );
};

export default DJRoster;
