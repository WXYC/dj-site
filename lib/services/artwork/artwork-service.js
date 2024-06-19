import getArtworkFromDiscogs from "./discogs-image";
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
  const getResponseOrNext = async (functions, index = 0) => {
    if (index >= functions.length) {
      return null;
    }

    const response = await functions[index]({ title, artist });
    if (response) {
      return response;
    }
    
    return getResponseOrNext(functions, index + 1);
  };

  let functions = [
    getArtworkFromDiscogs,
    getArtworkFromItunes,
    getArtworkFromLastFM
  ];

  // Shuffle functions array to randomize order
  for (let i = functions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [functions[i], functions[j]] = [functions[j], functions[i]];
  }

  const response = await getResponseOrNext(functions);
  return response;
};
