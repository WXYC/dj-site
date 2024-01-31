import { toast } from "sonner";
import { getter } from "../api-service";
import { CatalogResult, Genre, SearchInOption } from "@/lib/redux";
import { BRotationResult } from "./backend-types";
import { convertRotationResults } from "./conversions";



const getRotationEntries = () => getter("library/rotation")();


export const getRotation = async(): Promise<CatalogResult[] | null> => {

    const { data, error } = await getRotationEntries();

    if (error) {
      toast.error(error.message);
      return null;
    }

    return data?.map((item: BRotationResult) => 
      convertRotationResults(item)
    )?.filter((item: BRotationResult) => item.kill_date === null) ?? [];

}

export const getReleasesMatching = async (term: string, medium: SearchInOption, genre: Genre, n = 10) => {

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
  
    return data?.map((release) => ({
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
    })) ?? [];
  
}