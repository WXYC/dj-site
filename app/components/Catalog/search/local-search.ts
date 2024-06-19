import { RotationEntry } from "@/lib/redux";


export const findInRotation = (query: string, rotation: RotationEntry[]) => {
    if (query.length <= 3) return [];
    const searchTerms = query.toLowerCase().split(' ');

    var matches = [];

    for (var i = 0; i < rotation.length; i++) {
      var item = rotation[i];

      var isMatch = true;

      var terms = [item.album.artist.name.toLowerCase(), item.album.title.toLowerCase()];
      if (item.album.label) {
        terms.push(item.album.label.toLowerCase());
      }
      
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