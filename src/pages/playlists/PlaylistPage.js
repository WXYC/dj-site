import React from "react";
import { useParams } from "react-router-dom";

/**
 * @page
 * @category Playlists
 * @description Renders a page displaying a playlist, which is a set of flowsheet entries, getting the playlist name and DJ name from the URL.
 * This is currently a placeholder page.
 * 
 * @returns {JSX.Element} The rendered list of flowsheet entries for a given set.
 */
const PlaylistPage = () => {

    const { djName, playlistName } = useParams();

    return (
        <div>
            <h1>{djName}</h1>
            <h2>{playlistName}</h2>
        </div>
    )
}

export default PlaylistPage;