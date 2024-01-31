import { toast } from "sonner";
import { getter } from "../api-service";
import { CatalogResult, Genre, SearchInOption } from "@/lib/redux";
import { BRotationResult, BSearchResult } from "./backend-types";
import { convertRotationResult, convertSearchResult } from "./conversions";



const getRotationEntries = () => getter("library/rotation")();


export const getRotation = async(): Promise<CatalogResult[] | null> => {

    const { data, error } = await getRotationEntries();

    if (error) {
      toast.error(error.message);
      return null;
    }

    return data?.map((item: BRotationResult) => 
      convertRotationResult(item)
    )?.filter((item: BRotationResult) => item.kill_date === null) ?? [];

}

export const getReleasesMatching = async (params: SearchParameters): Promise<CatalogResult[] | null> => {

    let url = `library?n=${params.n}&`;

    switch (params.medium) {
      case "All":
        url += `artist_name=${params.term}&album_title=${params.term}`;
        break;
      case "Albums":
        url += `album_title=${params.term}`;
        break;
      case "Artists":
        url += `artist_name=${params.term}`;
        break;
      default:
        url += `artist_name=${params.term}&album_title=${params.term}`;
        break;
    }

    const { data, error } = await (getter(url))();
  
    if (error) {
      toast.error(error.message);
      return null;
    }
  
    return data?.map((release: BSearchResult) => convertSearchResult(release)) ?? [];
  
}

export interface SearchParameters {
  term: string;
  medium: SearchInOption;
  genre: Genre | "All";
  n: number;
};