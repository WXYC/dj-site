import { toast } from "sonner";
import { getter, setter } from "../api-service";
import { CatalogResult } from "@/lib/redux";
import { BRotationResult, BSearchResult } from "./backend-types";
import { convertRotationResult, convertSearchResult } from "./conversions";
import { RotationQueryParameters, SearchParameters } from "./frontend-types";

export const addRotationBackend = (params: RotationQueryParameters) => setter('library/rotation')({
  album_id: params.album_id,
  play_freq: params.play_freq
});

export const retrieveRotation = async(): Promise<CatalogResult[]> => {

    const { data, error } = await getter("library/rotation")();

    if (error) {
      toast.error(error.message);
      return [];
    }

    var relevantData = data?.filter((item: BRotationResult) => item.kill_date === null);
    sessionStorage.setItem("rotation", JSON.stringify(relevantData));

    return relevantData?.map((item: BRotationResult) => 
      convertRotationResult(item)
    );

}

export const getReleasesMatching = async (params: SearchParameters): Promise<CatalogResult[] | null> => {

    let url = `library?n=${params.n}&`;

    switch (params.medium) {
      case "All":
        url += `artist_name=${params.term}&album_title=${params.term}`;
        break;
      case "Albums":
        url += `album_title=${params.term}&artist_name=`;
        break;
      case "Artists":
        url += `artist_name=${params.term}&album_title=`;
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

    toast.success(`Found ${data?.length} results`);
  
    return data?.map((release: BSearchResult) => convertSearchResult(release)) ?? [];
  
}

