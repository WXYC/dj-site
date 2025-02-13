import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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

  const publicRoutes = [
    "/live",
    "/login",
  ];

  const pathname = usePathname();

  const [isPublic, setPublic] = useState(getIsPublic(pathname));

  useEffect(() => {
    setPublic(getIsPublic(pathname));
  }, [pathname]);

  function getIsPublic(route: string)
  {
    return publicRoutes.includes(route) || route.length <= 1;
  }

  return isPublic;
}