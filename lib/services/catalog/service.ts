import { CatalogResult } from "@/lib/redux";
import { onlyUnique } from "@/lib/utilities/unique";
import { toast } from "sonner";
import { getter, setter, updater } from "../api-service";
import { BRotationResult, BSearchResult } from "./backend-types";
import { convertRotationResult, convertSearchResult } from "./conversions";
import { RotationQueryParameters, SearchParameters } from "./frontend-types";

export const addRotationBackend = (params: RotationQueryParameters) =>
  setter("library/rotation")({
    album_id: params.album_id,
    play_freq: params.play_freq,
  });

export const removeFromRotationBackend = (params: RotationQueryParameters) =>
  updater("library/rotation")({
    album_id: null,
  });

export const retrieveRotation = async (): Promise<CatalogResult[]> => {
  const { data, error } = await getter("library/rotation")();

  if (error) {
    toast.error(error.message);
    return [];
  }

  var relevantData = data?.filter(
    (item: BRotationResult) => item.kill_date === null
  );
  sessionStorage.setItem("rotation", JSON.stringify(relevantData));

  return relevantData?.map((item: BRotationResult) =>
    convertRotationResult(item)
  );
};

export const getReleasesMatching = async (
  params: SearchParameters
): Promise<CatalogResult[] | null> => {
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

  const { data, error } = await getter(url)();

  if (error) {
    toast.error(error.message);
    return null;
  }

  const uniqueData: BSearchResult[] = data && onlyUnique(data, "id");

  toast.success(`Found ${uniqueData?.length} results`);

  let searchResults = uniqueData?.map((item: BSearchResult) => {
    let match = params.rotation?.find(
      (rotation: CatalogResult) => rotation.id === item.id
    );
    return match
      ? { ...item, rotation_freq: match.album.rotation?.toString() ?? "" }
      : item;
  });

  return (
    searchResults?.map((release: BSearchResult) =>
      convertSearchResult(release)
    ) ?? []
  );
};
