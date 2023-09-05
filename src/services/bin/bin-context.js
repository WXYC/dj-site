import React, { createContext, useEffect, useState } from 'react';
import { addToBinBackend, loadBin, removeFromBinBackend } from './bin-service';
import { toast } from 'sonner';
import { useAuth } from '../authentication/authentication-context';

// Create a new context
const BinContext = createContext();

// Create a provider component
const BinProvider = ({ children }) => {

  const { isAuthenticated } = useAuth();
  // State to store the bin array
  const [bin, setBin] = useState([]);

  const findInBin = (query) => {
    if (query.length <= 3) return [];
    const searchTerms = query.toLowerCase().split(' ');

    var matches = [];

    for (var i = 0; i < bin.length; i++) {
      var item = bin[i];

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

  // Add an item to the bin
  const addToBin = (item) => {
    // ensure the item is not already in the bin
    if (!isInBin(item)) {
      setBin((prevBin) => [...prevBin, item]);
      addToBinBackend(item.id);
    }
  };

  const isInBin = (item) => {
    return bin.some((i) => {
      return i.id === item.id;
    });
  };

  // Remove an item from the bin
  const removeFromBin = (item) => {
    setBin((prevBin) => prevBin.filter((i) => i.id != item.id));
    removeFromBinBackend(item.id);
  };

  // Clear the bin
  const clearBin = () => {
    for (var i = 0; i < bin.length; i++) {
      removeFromBinBackend(bin[i].id);
    }
    setBin([]);
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    loadBin().then((data) => {
      setBin(data);
    }).catch((error) => {
      toast.error(error.message);
    });
  }, [isAuthenticated]);

  // Value object to be passed to consumers of the context
  const contextValue = {
    bin,
    addToBin,
    removeFromBin,
    clearBin,
    isInBin,
    findInBin,
  };

  return (
    <BinContext.Provider value={contextValue}>
      {children}
    </BinContext.Provider>
  );
};

export { BinContext, BinProvider };
