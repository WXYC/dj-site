import { Box, Typography } from "@mui/joy";
import React, { useEffect } from "react";
import CatalogSearchTable from "../../components/catalog/CatalogSearchTable";
import { getRotation } from "../../services/card-catalog/card-catalog-service";
import { toast } from "sonner";

/**
 * CatalogPage component represents a page that displays a catalog search table.
 *
 * @page
 * @category Card Catalog
 * 
 * @returns {JSX.Element} The rendered CatalogPage component.
 */
const CatalogPage = (): JSX.Element => {

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
              Card Catalog
            </Typography>
            <Box sx = {{ flex: 999 }}></Box>
        </Box>
        <CatalogSearchTable />
        </>
    )
}

export default CatalogPage;