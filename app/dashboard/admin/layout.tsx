'use client';
import React, { useEffect, useState } from "react";
import { Box, Button, ColorPaletteProp, Divider, Link, Tab, TabList, TabPanel, Tabs, Typography } from "@mui/joy";
import { tabClasses } from "@mui/joy";
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { toast } from "sonner";
import { getAuthenticatedUser, useSelector } from "@/lib/redux";

interface StationManagementPageProps extends React.PropsWithChildren {
    style?: ColorPaletteProp;
}

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
const StationManagementPage = (props: StationManagementPageProps): JSX.Element => {

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
                    <Button variant="outlined" color={props.style ?? 'success'} endDecorator={<OpenInNewIcon fontSize="small" />} >AWS Management Console</Button>
                </Link>
            </Box>
        </Box>
        <Divider />
        { props.children }
        </>
    );
}

export default StationManagementPage;