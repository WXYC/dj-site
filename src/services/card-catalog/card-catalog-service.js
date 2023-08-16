import { toast } from "sonner";
import { callApi, getter, setter } from "../api-service";
import { refreshCognitoCredentials } from "../authentication/authentication-service";

const getRotationEntries = getter("library/rotation");

const tempRotationPost = () => setter("library/rotation")({
  album_id: 400,
  play_freq: 'H'
});

export const getRotation = async() => {

    const { data, error } = await getRotationEntries();

    if (error) {
      toast.error(error.message);
      return;
    }

    console.table(data);

}

export const getReleasesMatching = async (term, medium, genre, n = 10) => {

    let url = `library?n=${n}&`;

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
      id: release.id ?? -1,
      artist: {
        genre: release.genre_name ?? '',
        lettercode: release.code_letters ?? -1,
        numbercode: release.code_artist_number ?? -1,
        name: release.artist_name ?? ''
      },
      release_number: release.code_number ?? -1,
      format: release.format_name ?? '',
      title: release.album_title ?? '',
      alternate_artist: '',
      label: release.label_name ?? ''
    }));
  
}