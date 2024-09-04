'use client';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Button, ColorPaletteProp, Divider, Link, Typography } from "@mui/joy";
import React from "react";

const StationManagementPage = (props: React.PropsWithChildren): JSX.Element => {

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
                    <Button variant="outlined" color={'success'} endDecorator={<OpenInNewIcon fontSize="small" />} >AWS Management Console</Button>
                </Link>
            </Box>
        </Box>
        <Divider />
        { props.children }
        </>
    );
}

export default StationManagementPage;