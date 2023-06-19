import React from "react";
import { Box, Typography } from "@mui/joy";

const FlowsheetPage = () => {
    
    return (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
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
              Flowsheet
            </Typography>
            <Box sx = {{ flex: 999 }}></Box>
        </Box>
        </>
    );
}

export default FlowsheetPage;