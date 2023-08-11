import { toast } from "sonner";
import { callApi, getter } from "../api-service";
import { refreshCognitoCredentials } from "../authentication/authentication-service";

const getRotationEntries = getter("library?artist_name=A Guy Called Gerald&album_title=Automanikk");

export const getRotation = async() => {

    const cognitoISP = await refreshCognitoCredentials();

    const { data, error } = await getRotationEntries();

    if (error) {
      toast.error(error.message);
      return;
    }

    console.table(data);

}

export const getReleasesMatching = async (term, medium, genre) => {
  
    const cognitoISP = await refreshCognitoCredentials();

    let url = 'library?';

    switch (medium) {
      case "All":
        url += `artist_name=${term}&album_title=${term}`;
        break;
      case "Albums":
        url += `album_title=${term}`;
        break;
      case "Artists":
        url += `artist_name=${term}`;
        break;
      default:
        url += `artist_name=${term}&album_title=${term}`;
        break;
    }

    const { data, error } = await (getter(url))();
  
    if (error) {
      toast.error(error.message);
      return;
    }
  
    return data.map((release) => ({
      id: release.id,
      artist: {
        genre: release.genre_name,
        lettercode: release.code_letters,
        numbercode: release.code_artist_number,
        name: release.artist_name
      },
      release_number: release.code_number,
      format: release.format_name,
      title: release.album_title,
      alternate_artist: ''
    }));
  
}