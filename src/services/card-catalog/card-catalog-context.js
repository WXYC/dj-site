import { createContext, useContext, useEffect, useState } from "react";
import { getReleasesMatching } from "./card-catalog-service";

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

    const [reachedEndForQuery, setReachedEndForQuery] = useState(false);

    const [loading, setLoading] = useState(true);

    const [timeOut, setTimeOutState] = useState(null);
    
  const [releaseList, setReleaseList] = useState([]);
  const [orderBy, setOrderBy] = useState('Title');
  const [orderDirection, setOrderDirection] = useState('asc');

  const [searchIn, setSearchIn] = useState('All');
  const [genre, setGenre] = useState('All');


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
        const sortReleaseList = () => {
          const sortingAlgorithm = (orderDirection === 'asc') ? sorting_algorithms_asc[orderBy] : sorting_algorithms_desc[orderBy];
          const sortedReleaseList = [...releaseList].sort(sortingAlgorithm);
          setReleaseList(sortedReleaseList);
        }
    
        if (!loading) sortReleaseList();
    
    }, [orderBy, orderDirection, loading]);

    const loadMore = () => setN((prevN) => prevN + 10);

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
        reachedEndForQuery
    };

    return (
        <CatalogContext.Provider value={contextValue}>
            {children}
        </CatalogContext.Provider>
    );
}