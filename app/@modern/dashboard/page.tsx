"use client";

import { useGetAuthenticationQuery } from "@/lib/features/authentication/api";
import { useSearchCatalogQuery } from "@/lib/features/catalog/api";
import { CircularProgress } from "@mui/joy";
import { useEffect, useState } from "react";

// pages/index.js
export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: userData, isLoading: userIsLoading } = useGetAuthenticationQuery();

  useEffect(() => {
    console.log("userData", userData);
  }, [userData]);

/* 
  const { data, isLoading } = useSearchCatalogQuery({
    artist_name: searchTerm,
    album_name: searchTerm,
  }, {
    skip: userIsLoading || (!searchTerm && searchTerm.length < 5),
  });

  useEffect(() => {
    console.log("searchTerm", searchTerm);
    console.log("isLoading", isLoading);
    console.log(data);
  }, [data]); */

  return (
    <div>
      <h1>Welcome to Next.js</h1>
      <p>This is a basic page template.</p>
      <input type="text" placeholder="Search for an album"
        value={searchTerm}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          setSearchTerm(e.target.value);
        }}
      />
      {userIsLoading && <CircularProgress  size="sm"/>}
    </div>
  );
}
