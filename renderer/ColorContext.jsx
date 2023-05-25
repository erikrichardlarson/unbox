import React, { createContext, useState, useEffect } from "react";

const ColorContext = createContext();

export const ColorProvider = ({ children }) => {
  const defaultColors = {
    nowPlaying: "#000000",
    artist: "#000000",
    title: "#000000",
    label: "#000000",
    backgroundColor: "transparent",
  };

  const [colors, setColors] = useState(window.electron.store.get("colors") || {});

  useEffect(() => {
    window.electron.store.set("colors", colors);
  }, [colors]);

  const setColor = (key, color) => {
    setColors((prevColors) => ({ ...prevColors, [key]: color }));
  };

  const mergedColors = { ...defaultColors, ...colors };

  return (
    <ColorContext.Provider value={{ colors: mergedColors, setColor }}>
      {children}
    </ColorContext.Provider>
  );
};
export default ColorContext;
