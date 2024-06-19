'use client';

const ClassicArtistPage = () => {
    return (
        <div id="searchResultsPanel">
  
	<table cellPadding="10" cellSpacing="1" border={0} style = {{ width: "100%" }}><tbody><tr><td>
      </td></tr><tr className="artistCardHeader" style = {{ background: "#CCCCCC" }}>
	    <th style = {{ width: "20%" }} className="label">
          <b>Rock&nbsp;ME 156</b>
	    </th>
        <th style = {{ width: "60%" }} align="center" className="label"><b>Melkbelly</b></th>
        <th style = {{ width: "20%" }} align="right" className="label"><b># of releases: 1</b></th>
      </tr>
    </tbody></table>
 
    
    <table align="center" cellPadding="10" cellSpacing="1" border={0} style = {{ width: "100%" }}>
      <tbody><tr className="searchResultsHeader" style = {{ background: "#CCCCCC" }}>
        <th align="left" style = {{ width: "15%" }} className="label sortFieldHighlight" id="libcodeHeader">Library Code</th>
        <th align="left" style = {{ width: "28%" }} className="label">Artist</th>
        <th align="left" style = {{ width: "35%" }} className="label" id="titleHeader">Title of Release</th>
        <th align="left" style = {{ width: "15%" }} className="label" id="formatHeader">Format</th>
        <th align="center" style = {{ width: "7%" }} className="label">Comment(s)</th> 
      </tr>
      
        <tr style = {{ background: "#F3F3F3" }}>
          <td className="text">Rock
            ME 156/
            1
          </td>
          <td className="text">Melkbelly</td>
          <td className="text">Pith</td>
          <td className="text">cd</td>
          <td align="center" className="text">
    	  <a href="comment?objectType=release&amp;ID=68894">
    	  
    	  <img src="/img/commentIcon.jpg" title="Make a comment about this release" />
    	  
    	  </a></td>
        </tr>	
      
    </tbody></table>
</div>
    );
}

export default ClassicArtistPage;