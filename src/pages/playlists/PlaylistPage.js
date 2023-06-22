import React from "react";
import { useParams } from "react-router-dom";

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