import getArtworkFromDiscogs from "./discogs-image"
import getArtworkFromItunes from "./itunes-image";
import getArtworkFromLastFM from "./last-fm-image";

/**
 * Get artwork for a song
 * @param {string} title - The song title
 * @param {string} artist - The song artist
 * @returns {string} The artwork URL
 * @description
 * Randomly selects a service to get artwork from. If the service returns null, the next service is tried until one returns a URL or all services have been tried.
 */ 
export const getArtwork = async (title, artist) => {

    const getResponseOrNext = async (responseFunction, next) => {
        const response = await responseFunction({
            title,
            artist
        });
        if (response) {
            return response;
        }
        return next();
    }

    let functions = [
        getArtworkFromDiscogs,
        getArtworkFromItunes,
        getArtworkFromLastFM
    ];

    let first = Math.floor(Math.random() * functions.length);
    let second = (first + 1) % functions.length;
    let third = (second + 1) % functions.length;

    const response = await getResponseOrNext(functions[first], async () => {
        return await getResponseOrNext(functions[second], async () => {
            return await getResponseOrNext(functions[third], async () => {
                return null;
            });
        });
    });

    return response;
}