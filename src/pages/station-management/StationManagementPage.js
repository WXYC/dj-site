import React from "react";
import { Box, Button, Link, Tab, TabList, TabPanel, Tabs, Typography } from "@mui/joy";
import { tabClasses } from "@mui/joy";
import DJRoster from "../../components/station-management/DJRoster";
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

const StationManagementPage = ({style}) => {
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
            position: 'relative',
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
        <Tab sx = {{ py: 1.5 }}>DJ Roster</Tab>
        <Tab sx = {{ py: 1.5 }}>Station Schedule</Tab>
        <Tab sx = {{ py: 1.5 }}>Catalog</Tab>
      </TabList>
      <TabPanel value={0}>
        <DJRoster />
        </TabPanel>
        </Tabs>
        </>
    );
}

export default StationManagementPage;