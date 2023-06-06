import React, { createContext, useState } from 'react';

// Create a new context
const BackpackContext = createContext();

// Create a provider component
const BackpackProvider = ({ children }) => {
  // State to store the backpack array
  const [backpack, setBackpack] = useState([]);

  // Add an item to the backpack
  const addToBackpack = (item) => {
    // ensure the item is not already in the backpack
    if (!isInBackpack(item)) {
      setBackpack((prevBackpack) => [...prevBackpack, item]);
    }
  };

  const isInBackpack = (item) => {
    return backpack.includes(item);
  };

  // Remove an item from the backpack
  const removeFromBackpack = (item) => {
    setBackpack((prevBackpack) => prevBackpack.filter((i) => i !== item));
  };

  // Clear the backpack
  const clearBackpack = () => {
    setBackpack([]);
  };

  // Value object to be passed to consumers of the context
  const contextValue = {
    backpack,
    addToBackpack,
    removeFromBackpack,
    clearBackpack,
    isInBackpack,
  };

  return (
    <BackpackContext.Provider value={contextValue}>
      {children}
    </BackpackContext.Provider>
  );
};

export { BackpackContext, BackpackProvider };
