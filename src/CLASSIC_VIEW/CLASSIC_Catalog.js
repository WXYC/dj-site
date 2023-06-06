import React, { useState } from "react";

const CLASSIC_CatalogPage = ({ logout }) => {

    const [searchString, setSearchString] = useState("");
    const [openResults, setOpenResults] = useState(false);

   const handleSubmit = (event) => {
        event.preventDefault();
        if (searchString.length > 0) setOpenResults(true);
        console.log(event.target.searchString.value);
        setSearchString(event.target.searchString.value);
    }

    if (searchString.length > 0 || openResults) {
        return (
            <div style={{ position: 'relative' }}>
            <div id="adminLogin">

                <b>Welcome, WXYC DJ</b><br />
                <b><a href="login?loginAction=endSession">Logout or Switch Users</a></b>

                </div>

                <form name="searchForm" onSubmit={handleSubmit}>
                <div id="searchString">
                <input type="text" name="searchString" size="40" value={searchString} onChange={(e) => {
                    e.preventDefault();
                    setSearchString(e.target.value);
                }} />
                </div>
                <div id="searchButton"><input type='submit' value="Search WXYC Library!" /></div>
                <div id="sortbyRelevance">
                <b><a href="searchCardCatalog" onClick={(e) => {
                    e.preventDefault();
                    setOpenResults(false);
                    setSearchString("");
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

                        <li><a href="javascript:selectGenreFacet('Blues')">Blues</a></li>
                        
                        <li><a href="javascript:selectGenreFacet('Electronic')">Electronic</a></li>
                        
                        <li><a href="javascript:selectGenreFacet('Hiphop')">Hiphop</a></li>
                        
                        <li><a href="javascript:selectGenreFacet('Jazz')">Jazz</a></li>
                        
                        <li><a href="javascript:selectGenreFacet('OCS')">OCS</a></li>
                        
                        <li><a href="javascript:selectGenreFacet('Rock')">Rock</a></li>
                        
                        <li><a href="javascript:selectGenreFacet('Soundtracks')">Soundtracks</a></li>
                        
                <p>&nbsp;</p>

                <b>Format</b><p></p>


                <li><a href="javascript:selectFormatFacet('cd')">cd</a></li>

                <li><a href="javascript:selectFormatFacet('vinyl')">vinyl</a></li>

                </div>
                
                <div id="searchResultsPanel">

&nbsp;&nbsp;Click on "Artist" or "Title" column headings to sort on those fields.&nbsp; 


<p></p>
&nbsp;&nbsp;Displaying 1 - 50 of 
<b>53</b> results
matching text query <b>hello</b><p></p>&nbsp;&nbsp;&nbsp;<b>1</b>
&nbsp;&nbsp;<a href="javascript:showPage(2)">2</a>
&nbsp;&nbsp;

<p></p>

  <table cellpadding="8" cellspacing="1" border="0" width="100%">
  <tr class="searchResultsHeader">
    <th align="center" class="label" colspan="2" width="20%" class="label">Library Code</th>
    <th align="left" class="label" width="35%" id="artistHeader">Artist Name</th>
    <th align="left" class="label" width="35%" id="releaseHeader">Title Of Release</th>
    <th align="center" width="10%" class="label">Format</th>
  </tr>
	
        <tr bgcolor="#F3F3F3">
          <td class="text" align="right">Rock</td>
          <td class="text" align="left">HO 143/1</td>
		  <td class="text"><a href="artist?id=9465&amp;mode=view">
		  Howard Hello
		  </a></td>
		  <td class="text"><a href="libraryRelease?id=25674">Howard Hello</a></td>
		  <td align="center" class="text">cd</td>
		  </tr>

    </table>
                </div>

            </div>
        )
    } else {
        return (
            <div>
                <form onSubmit={handleSubmit}>
                <div align="center">
                    <table cellpadding="5" cellspacing="1" border="0" width="75%" align="center">
                    <tr>
                        <td align="center" valign="top">
                        <span class="title">Search the&nbsp;&nbsp;</span>
                        <img src="img/wxyc-logo-classic.gif" alt="WXYC logo" border="0" />
                        <span class="title">&nbsp;&nbsp;Library:</span>
                        </td>
                    </tr>
                    <tr>
                        <td align="center"><input type="text" name="searchString" size={60} /></td>
                    </tr>
                    <tr>
                        <td align="center">
                        <input type="submit" value="&#160;&#160;Search the WXYC Library!&#160;&#160;" />&nbsp;&nbsp;&nbsp;&nbsp;
                        <input type="reset" value="Clear Box" />
                        </td>
                    </tr>
                    <tr>
                        <td align="center"><span class="text"></span></td>
                    </tr>
                    <tr>
                        <td align="center"><span class="smalltext">Program last modified: July 5, 2023.</span></td>
                    </tr>
                    <tr>
                        <td align="center"><span class="text">56,000+ total releases in this database.</span></td>
                    </tr>
                    </table>
                </div>
                </form>

                <p>&nbsp;</p>

                <div id="notes" class="smalltext" align="center">
                <b>Tips for searching the WXYC Library:</b>
                <p>Look up whatever you want!</p>
                </div>
            </div>
            );
  }
}

export default CLASSIC_CatalogPage;
