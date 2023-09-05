import React, { useEffect, useState } from "react";
import { Box, Button, Link, Tab, TabList, TabPanel, Tabs, Typography } from "@mui/joy";
import { tabClasses } from "@mui/joy";
import DJRoster from "../../components/station-management/roster/DJRoster";
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { toast } from "sonner";
import { Auth } from "aws-amplify";
import StationSchedule from "../../components/station-management/station-schedule/StationSchedule";
import { useAuth } from "../../services/authentication/authentication-context";
import { RotationManagement } from "../../components/station-management/rotation/Rotation";
import { listUsers } from "../../services/station-management/admin-service";

/**
 * Depicts the station management page from a station manager perspective.
 * @page
 * @category Station Management
 * 
 * @param {Object} props - The component props.
 * @param {string} [props.style] - The style of the page. Defaults to the success color.
 * 
 * @returns {JSX.Element} The rendered StationManagementPage component.
 * @example
 * return (
 *  <StationManagementPage />
 * )
 */
const StationManagementPage = ({style}) => {

  const { user } = useAuth();

  const [djs, setDjs] = useState([]);
  const [loading, setLoading] = useState(true);

  const updateDjs = async () => {
    setLoading(true);
    listUsers().then((data) => {
      setDjs(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    updateDjs();
  }, []);

    return (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
                justifyContent: 'flex-end',
              my: 1,
              gap: 1,
              flexWrap: 'wrap',
              '& > *': {
                minWidth: 'clamp(0px, (500px - 100%) * 999, 100%)',
                flexGrow: 1,
              },
            }}
          >
            <Typography level="h1">
              Station Management
            </Typography>
            <Box sx = {{ justifyContent: 'flex-end', display: 'flex' }}>
                <Link
                    href="https://wxyc.awsapps.com/start#/"
                    target="_blank"
                    sx = {{
                        '&:hover': {
                            textDecoration: 'none',
                        },
                    }}
                >
                    <Button variant="outlined" color={style ?? 'success'} endDecorator={<OpenInNewIcon fontSize="small" />} >AWS Management Console</Button>
                </Link>
            </Box>
        </Box>
        <Tabs
            size="sm"
            aria-label="Station Management Tabs"
            defaultValue={0}
            color={style ?? 'success'}
            sx = {(theme) => ({
                '--Tabs-gap': '0px',
                borderRadius: 'lg',
                border: `1px solid ${theme.palette.divider}`,
                width: '100%',
                flex: 1,

                
                position: 'relative',
            })}
        >
        <TabList
        sx={{
          '--ListItem-radius': '0px',
          borderRadius: 0,
          [`& .${tabClasses.root}`]: {
            fontWeight: 'md',
            flex: 1,
            bgcolor: 'background.body',
            [`&.${tabClasses.selected}`]: {
              color: `${style ?? 'success'}.500`,
            },
            [`&.${tabClasses.selected}:before`]: {
              content: '""',
              display: 'block',
              position: 'absolute',
              bottom: -1,
              width: '100%',
              height: 2,
              bgcolor: `${style ?? 'success'}.400`,
            },
            [`&.${tabClasses.focusVisible}`]: {
              outlineOffset: '-3px',
            },
          },
        }}
      >
        <Tab sx = {{ py: 1.5 }}>Roster</Tab>
        <Tab sx = {{ py: 1.5 }}>Schedule</Tab>
        <Tab sx = {{ py: 1.5 }}>Rotation</Tab>
        <Tab sx = {{ py: 1.5 }}>Catalog</Tab>
      </TabList>
      <TabPanel value={0}>
        <DJRoster  
          roster={djs} 
          updateDjs={updateDjs}
          setDjs={setDjs}
          loading={loading}
          setLoading={setLoading}
        />
        </TabPanel>
        <TabPanel value={1}
        sx = {{
          flex: '0 1 auto',
        }}
        >
        <StationSchedule
          roster={djs}
        />
        </TabPanel>
        <TabPanel value={2}>
          <RotationManagement />
        </TabPanel>
        <TabPanel value={3}>
          <Typography level="h2">Coming Soon</Typography>
        </TabPanel>
        </Tabs>
        </>
    );
}

export default StationManagementPage;