import { createContext, useContext, useEffect, useState } from "react";
import { getReleasesMatching, getRotation } from "./card-catalog-service";
import { toast } from "sonner";
import { useAuth } from "../authentication/authentication-context";

const TIMEOUT_MS = 800;

const sorting_algorithms_asc = {
  'Code': (a, b) => {
            let codeA = `${a.artist.genre} ${a.artist.lettercode} ${a.artist.numbercode}/${a.release_number}`;
            let codeB = `${b.artist.genre} ${b.artist.lettercode} ${b.artist.numbercode}/${b.release_number}`;
            return codeA.localeCompare(codeB);
          },
  'Title': (a, b) => (a.title < b.title) ? -1 : (a.title > b.title) ? 1 : 0,
  'Artist': (a, b) => (a.artist.name < b.artist.name) ? -1 : (a.artist.name > b.artist.name) ? 1 : 0,
  'Genre': (a, b) => (a.artist.genre < b.artist.genre) ? -1 : (a.artist.genre > b.artist.genre) ? 1 : 0,
  'Format': (a, b) => a.format.localeCompare(b.format),
}

const sorting_algorithms_desc = {
  'Code': (a, b) => {
            let codeA = `${a.artist.genre} ${a.artist.lettercode} ${a.artist.numbercode}/${a.release_number}`;
            let codeB = `${b.artist.genre} ${b.artist.lettercode} ${b.artist.numbercode}/${b.release_number}`;
            return codeB.localeCompare(codeA);
          },
  'Title': (a, b) => (b.title < a.title) ? -1 : (b.title > a.title) ? 1 : 0,
  'Artist': (a, b) => (b.artist.name < a.artist.name) ? -1 : (b.artist.name > a.artist.name) ? 1 : 0,
  'Genre': (a, b) => (b.artist.genre < a.artist.genre) ? -1 : (b.artist.genre > a.artist.genre) ? 1 : 0,
  'Format': (a, b) => b.format.localeCompare(a.format),
}

const CatalogContext = createContext();

export const useCatalog = () => useContext(CatalogContext);

export const CatalogProvider = ({children}) => {

    const [n, setN] = useState(10);
    const [searchString, setSearchString] = useState("");
    const { isAuthenticated } = useAuth();

    const [reachedEndForQuery, setReachedEndForQuery] = useState(false);

    const [loading, setLoading] = useState(true);

    const [timeOut, setTimeOutState] = useState(null);
    
  const [releaseList, setReleaseList] = useState([]);
  const [orderBy, setOrderBy] = useState('Title');
  const [orderDirection, setOrderDirection] = useState('asc');

  const [searchIn, setSearchIn] = useState('All');
  const [genre, setGenre] = useState('All');

  
  const [rotation, setRotation] = useState([]);


    useEffect(() => {

        if (timeOut) {
          clearTimeout(timeOut);
        }
    
        setLoading(true);
    
        setTimeOutState(
          setTimeout(async () => {
            
            if (searchString.length > 0) {
              let data = await getReleasesMatching(searchString, searchIn, genre, n);
  
              if (data != null) {
                setReleaseList(data);
                console.log(data);
              }
            }
  
            setLoading(false);
          }, TIMEOUT_MS)
        );
      }, [searchString, searchIn, genre, n]);

      useEffect(() => {
        setN(10);
    }, [searchString]);

    useEffect(() => {
        if (releaseList.length < n) {
            setReachedEndForQuery(true);
        } else {
            setReachedEndForQuery(false);
        }
    }, [releaseList, n]);


    useEffect(() => {
      
      const sortingAlgorithm = (orderDirection === 'asc') ? sorting_algorithms_asc[orderBy] : sorting_algorithms_desc[orderBy];
      const sortedReleaseList = [...releaseList].sort(sortingAlgorithm);
      setReleaseList(sortedReleaseList);
    
    }, [orderBy, orderDirection]);

    const loadMore = () => setN((prevN) => prevN + 10);
    

  const findInRotation = (query) => {
    console.log(rotation.length);
    if (query.length <= 3) return [];
    const searchTerms = query.toLowerCase().split(' ');

    var matches = [];

    for (var i = 0; i < rotation.length; i++) {
      var item = rotation[i];

      console.log(item);

      var isMatch = true;

      var terms = [item.artist.name.toLowerCase(), item.title.toLowerCase(), item.label.toLowerCase()];
      for (var j = 0; j < searchTerms.length; j++) {
        var searchTerm = searchTerms[j];
  
        // Check if any of the terms match the search term
        var termMatches = terms.some(term => term.indexOf(searchTerm) !== -1);
  
        // If the current search term doesn't match any of the terms, break the loop
        if (!termMatches) {
          isMatch = false;
          break;
        }
      }

      // If all search terms match any of the terms, add the item to the matches
      if (isMatch) {
        matches.push(item);
      }
    }
  
    return matches;
  };


  useEffect(() => {
    if (!isAuthenticated) return;

    getRotation().then((data) => {
      setRotation(data);
    }).catch((error) => {
      toast.error("Failed to load rotation.");
      console.error(error);
    });
  }, [isAuthenticated]);

    const contextValue = {
        n,
        loadMore,
        searchString,
        setSearchString,
        searchIn,
        setSearchIn,
        genre,
        setGenre,
        loading,
        setLoading,
        releaseList,
        orderBy,
        setOrderBy,
        orderDirection,
        setOrderDirection,
        reachedEndForQuery,
        findInRotation
    };

    return (
        <CatalogContext.Provider value={contextValue}>
            {children}
        </CatalogContext.Provider>
    );
}