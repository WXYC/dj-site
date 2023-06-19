import getArtworkFromDiscogs from "./discogs-image"
import getArtworkFromItunes from "./itunes-image";
import getArtworkFromLastFM from "./last-fm-image";


export const getArtwork = async ({
    title,
    artist
}) => {

    const discogsReponse = await getArtworkFromDiscogs({
        title,
        artist
    });
    if (discogsReponse) {
        return discogsReponse;
    }

    const lastFMResponse = await getArtworkFromLastFM({
        title,
        artist
    });
    if (lastFMResponse) {
        return lastFMResponse;
    }

    const iTunesResponse = await getArtworkFromItunes({
        title,
        artist
    });
    if (iTunesResponse) {
        return iTunesResponse;
    }

    return null;
}