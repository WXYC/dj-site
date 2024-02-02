'use client';
import AuthenticationGuard from "@/app/components/Authentication/AuthenticationGuard";
import LogoutClassic from "@/app/components/Classic/LogoutClassic";
import { Genre, OrderByOption, OrderDirectionOption, SearchInOption, catalogSlice, getAuthenticatedUser, getCatalogLoading, getGenre, getN, getOrderBy, getOrderDirection, getQuery, getReachedEnd, getResults, getSearchIn, searchCatalog, useDispatch, useSelector } from "@/lib/redux";
import React, { useCallback, useEffect, useState } from "react";

const ClassicCatalogPage = () => {
    
    const dispatch = useDispatch();

    const user = useSelector(getAuthenticatedUser);

    // Catalog Search State ----------------------------------------------------
    const loadMore = () => dispatch(catalogSlice.actions.loadMore());
    const loading = useSelector(getCatalogLoading);
    const searchString = useSelector(getQuery);
    const setSearchString = (value: string) => dispatch(catalogSlice.actions.setQuery(value));
    const genre = useSelector(getGenre);
    const setGenre = (value: Genre) => dispatch(catalogSlice.actions.setGenre(value));
    const searchIn = useSelector(getSearchIn);
    const setSearchIn = (value: SearchInOption) => dispatch(catalogSlice.actions.setSearchIn(value));
    const releaseList = useSelector(getResults);
    const orderBy = useSelector(getOrderBy);
    const handleRequestSort = (value: OrderByOption) => dispatch(catalogSlice.actions.setOrderBy(value));
    const orderDirection = useSelector(getOrderDirection);
    const setOrderDirection = (value: OrderDirectionOption) => dispatch(catalogSlice.actions.setOrderDirection(value));
    const reachedEndForQuery = useSelector(getReachedEnd);
    const n = useSelector(getN);
    // -------------------------------------------------------------------------
    const [openResults, setOpenResults] = useState(false);

    const [localSearchString, setLocalSearchString] = useState(searchString);

    const handleSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (searchString.length > 0) setOpenResults(true);
        console.log(event.currentTarget.localSearchString.value);
        setSearchString(localSearchString);
    }, [localSearchString, searchString]);

    const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | undefined>(undefined);

    useEffect(() => {
        if (loading) {
            document.body.style.cursor = 'wait';
        } else {
            document.body.style.cursor = 'default';
        }

        return () => {
            document.body.style.cursor = 'default';
        }
    }, [loading]);

    useEffect(() => {
        if (reachedEndForQuery) return;
  
        clearTimeout(searchTimeout);
        setSearchTimeout(setTimeout(() => {
          dispatch(searchCatalog({
            term: searchString,
            medium: searchIn,
            genre: genre,
            n: n
          }));
        }, 500));
      }, [searchString, searchIn, genre, n]);

    if (openResults || searchString.length > 0) {
        return (
            <div style={{ position: 'relative' }}>
            <AuthenticationGuard redirectTo='/login' savePath />
            <div id="adminLogin">

                <b>Welcome, {user?.name ?? `DJ ${user?.djName}`}</b><br />
                <b><LogoutClassic /></b>

                </div>

                <form name="searchForm" onSubmit={handleSubmit}>
                <div id="searchString">
                <input type="text" name="localSearchString" size={40} value={localSearchString} onChange={(e) => {
                    e.preventDefault();
                    setLocalSearchString(e.target.value);
                }} />
                </div>
                <div id="searchButton"><input type='submit' value="Search WXYC Library!" /></div>
                <div id="sortbyRelevance">
                <b><a href="searchCardCatalog" onClick={(e) => {
                    e.preventDefault();
                    setOpenResults(false);
                    setLocalSearchString("");
                }}>Search Tips</a></b>
                </div>
                </form>


                <div id="facetLinksHeader">

                <b>Top Results (53)</b>

                <p></p>
                Narrow by...<br />
                </div>
                
                <div id="facetLinks">

                <b>Genre</b><p></p>
                <li><a style={{ fontWeight: (genre == "Unknown" || genre == "All") ? "bold" : "initial" }} href="#" onClick={() => setGenre("Unknown")}>Any</a></li>

                        <li><a style={{ fontWeight: (genre == "Blues") ? "bold" : "initial" }} href="#" onClick={() => setGenre("Blues")}>Blues</a></li>
                        
                        <li><a style={{ fontWeight: (genre == "Electronic") ? "bold" : "initial" }} href = "#" onClick={() => setGenre("Electronic")}>Electronic</a></li>
                        
                        <li><a style={{ fontWeight: (genre == "Hiphop") ? "bold" : "initial" }} href = "#" onClick={() => setGenre("Hiphop")}>Hiphop</a></li>
                        
                        <li><a style={{ fontWeight: (genre == "Jazz") ? "bold" : "initial" }} href = "#" onClick={() => setGenre("Jazz")}>Jazz</a></li>
                        
                        <li><a style={{ fontWeight: (genre == "OCS") ? "bold" : "initial" }} href = "#" onClick={() => setGenre("OCS")}>OCS</a></li>
                        
                        <li><a style={{ fontWeight: (genre == "Rock") ? "bold" : "initial" }} href = "#" onClick={() => setGenre("Rock")}>Rock</a></li>
                        
                        <li><a style={{ fontWeight: (genre == "Soundtracks") ? "bold" : "initial" }} href = "#" onClick={() => setGenre("Soundtracks")}>Soundtracks</a></li>
                        
                <p>&nbsp;</p>

                <b>Format</b><p></p>


                <li><a href = "#" onClick={() => console.log("cd")}>cd</a></li>

                <li><a href = "#" onClick={() => console.log("vinyl")}>vinyl</a></li>

                </div>
                
                <div id="searchResultsPanel">


<p></p>
&nbsp;&nbsp;Displaying <b>{releaseList.length}</b> results
matching text query <b>{searchString}</b><p></p>
&nbsp;&nbsp;{!reachedEndForQuery && (<a href="#" onClick={loadMore}>Load more</a>)}
&nbsp;&nbsp;

<p></p>

  <table cellPadding={8} cellSpacing="1" border={0} style={{ width: "100%" }}>
  <tr className="searchResultsHeader">
    <th align="center" className="label" colSpan={2} style={{ width: "20%" }}>Library Code</th>
    <th align="left" className="label" style={{ width: "35%" }} id="artistHeader">Artist Name</th>
    <th align="left" className="label" style={{ width: "35%" }} id="releaseHeader">Title Of Release</th>
    <th align="center" style={{ width: "10%" }} className="label">Format</th>
  </tr>
	{releaseList.map((row) => (
        <tr style={{ background: "#F3F3F3" }}>
          <td className="text" align="right">{row.album.artist.genre}</td>
          <td className="text" align="left">{row.album.artist.lettercode} {row.album.artist.numbercode}/{row.album.release}</td>
		  <td className="text"><a href="artist?id=9465&amp;mode=view">
		  {row.album.artist.name}
		  </a></td>
		  <td className="text"><a href="libraryRelease?id=25674">{row.album.title}</a></td>
		  <td align="center" className="text">{row.album.format}</td>
		  </tr>
    ))}
    </table>
                </div>

            </div>
        )
    } else {
        return (
            <div>
                <AuthenticationGuard redirectTo='/login' savePath />
                <form onSubmit={handleSubmit}>
                <div>
                    <table cellPadding="5" cellSpacing={1} border={0} style={{ width: "75%" }} align="center">
                    <tr>
                        <td align="center" valign="top">
                        <span className="title">Search the&nbsp;&nbsp;</span>
                        <img src="/img/wxyc-logo-classic.gif" alt="WXYC logo" style={{ border: 0 }} />
                        <span className="title">&nbsp;&nbsp;Library:</span>
                        </td>
                    </tr>
                    <tr>
                        <td align="center"><input type="text" name="localSearchString" size={60} value={localSearchString} onChange={(e) => {
                                                e.preventDefault();
                                                setLocalSearchString(e.target.value);
                                            }} /></td>
                    </tr>
                    <tr>
                        <td align="center">
                        <input type="submit" value="&#160;&#160;Search the WXYC Library!&#160;&#160;" />&nbsp;&nbsp;&nbsp;&nbsp;
                        <input type="reset" value="Clear Box" />
                        </td>
                    </tr>
                    <tr>
                        <td align="center"><span className="text"></span></td>
                    </tr>
                    <tr>
                        <td align="center"><span className="smalltext">Program last modified: February 2, 2024.</span></td>
                    </tr>
                    <tr>
                        <td align="center"><span className="text">56,000+ total releases in this database.</span></td>
                    </tr>
                    </table>
                </div>
                </form>

                <p>&nbsp;</p>

                <div id="notes" className="smalltext">
                <b>Tips for searching the WXYC Library:</b>
                <p>Look up whatever you want!</p>
                </div>
            </div>
            );
  }
}

export default ClassicCatalogPage;
