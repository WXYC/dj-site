import React, { createContext, useState } from 'react';

// Create a new context
const BinContext = createContext();

// Create a provider component
const BinProvider = ({ children }) => {
  // State to store the bin array
  const [bin, setBin] = useState([]);

  const findInBin = (query, matchBy) => {
    if (query.length < 3) return bin;
    let result = bin.fuzzySearchByNestedProps(query, matchBy);
    return result;
  };

  // Add an item to the bin
  const addToBin = (item) => {
    // ensure the item is not already in the bin
    if (!isInBin(item)) {
      setBin((prevBin) => [...prevBin, item]);
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
  };

  // Clear the bin
  const clearBin = () => {
    setBin([]);
  };

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
