import { Input, Sheet, Table } from "@mui/joy";
import React, { useState } from "react";
import { SearchBar } from "../../catalog/search/SearchBar";
import { useCatalog } from "../../../services/card-catalog/card-catalog-context";

export const CatalogEditor = (props) => {

    const { 
        loadMore,
        searchString, 
        setSearchString, 
        setSearchIn,
        setGenre,
        loading, 
        releaseList, 
        orderBy, 
        setOrderBy, 
        orderDirection, 
        setOrderDirection,
        reachedEndForQuery
      } = useCatalog();

    return (
        <Sheet
            sx = {{
                p: 2,
            }}
        >
            <SearchBar
                color="success"
                searchString={searchString}
                setSearchString={setSearchString}
                setSearchIn={setSearchIn}
                setGenre={setGenre}
            />
            <Table>

            </Table>
        </Sheet>
    )
};