import React, { createContext, useState } from 'react';

// Create a new context
const BinContext = createContext();

// Create a provider component
const BinProvider = ({ children }) => {
  // State to store the bin array
  const [bin, setBin] = useState([]);

  // Add an item to the bin
  const addToBin = (item) => {
    // ensure the item is not already in the bin
    if (!isInBin(item)) {
      setBin((prevBin) => [...prevBin, item]);
    }
  };

  const isInBin = (item) => {
    return bin.includes(item);
  };

  // Remove an item from the bin
  const removeFromBin = (item) => {
    setBin((prevBin) => prevBin.filter((i) => i !== item));
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
  };

  return (
    <BinContext.Provider value={contextValue}>
      {children}
    </BinContext.Provider>
  );
};

export { BinContext, BinProvider };
