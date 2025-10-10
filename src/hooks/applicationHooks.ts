import { authenticationApi } from "@/lib/features/authentication/api";
import { authenticationSlice } from "@/lib/features/authentication/frontend";
import { binApi } from "@/lib/features/bin/api";
import { catalogApi } from "@/lib/features/catalog/api";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import { flowsheetApi } from "@/lib/features/flowsheet/api";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppDispatch } from "@/lib/hooks";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import getArtworkFromDiscogs from "./artwork/discogs-image";
import getArtworkFromItunes from "./artwork/itunes-image";
import getArtworkFromLastFM from "./artwork/last-fm-image";

export function useWindowSize() {
  // Initialize state with undefined width/height so server and client renders match
  // Learn more here: https://joshwcomeau.com/react/the-perils-of-rehydration/
  const [windowSize, setWindowSize] = useState<{
    width: number | undefined;
    height: number | undefined;
  }>({
    width: undefined,
    height: undefined,
  });

  useEffect(() => {
    // only execute all the code below in client side
    // Handler to call on window resize
    function handleResize() {
      // Set window width/height to state
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    // Add event listener
    window.addEventListener("resize", handleResize);

    // Call handler right away so state gets updated with initial window size
    handleResize();

    // Remove event listener on cleanup
    return () => window.removeEventListener("resize", handleResize);
  }, []); // Empty array ensures that effect is only run on mount
  return windowSize;
}

export const usePublicRoutes = () => {
  const publicRoutes = ["/live", "/login"];
  const pathname = usePathname();

  // Calculate during render - no useState/useEffect needed
  const isPublic = useMemo(() => {
    return publicRoutes.includes(pathname) || pathname.length <= 1;
  }, [pathname]);

  return isPublic;
};

export const useAlbumImages = () => {
  const DEFAULT_URL = "/img/cassette.png";

  const [album, setAlbum] = useState<string | undefined>(undefined);
  const [artist, setArtist] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const [url, setUrl] = useState<string>(DEFAULT_URL);

  let functions = [
    getArtworkFromDiscogs,
    getArtworkFromItunes,
    getArtworkFromLastFM,
  ];

  const getImageForSong = async (album?: string, artist?: string) => {
    setLoading(true);

    if (!album || !artist) {
      setLoading(false);
      return DEFAULT_URL;
    }

    let first = Math.floor(Math.random() * functions.length);
    let second = (first + 1) % functions.length;
    let third = (second + 1) % functions.length;

    const response =
      (await functions[first]({
        title: album,
        artist: artist,
      })) ??
      (await functions[second]({
        title: album,
        artist: artist,
      })) ??
      (await functions[third]({
        title: album,
        artist: artist,
      })) ??
      DEFAULT_URL;

    setLoading(false);
    return response;
  };

  useEffect(() => {
    (async () => {
      setUrl(await getImageForSong(album, artist));
    })();
  }, [album, artist]);

  return {
    setAlbum,
    setArtist,
    loading,
    url,
  };
};

export const useShiftKey = () => {
  const [shiftKeyPressed, setShiftKeyPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        setShiftKeyPressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        setShiftKeyPressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return shiftKeyPressed;
};

export function resetApplication(dispatch: ReturnType<typeof useAppDispatch>) {
  dispatch(flowsheetApi.util.resetApiState());
  dispatch(flowsheetSlice.actions.reset());
  dispatch(catalogApi.util.resetApiState());
  dispatch(catalogSlice.actions.reset());
  dispatch(binApi.util.resetApiState());
  dispatch(authenticationApi.util.resetApiState());
  dispatch(authenticationSlice.actions.reset());
}
