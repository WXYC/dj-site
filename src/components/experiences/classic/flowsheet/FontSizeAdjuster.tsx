"use client";

import { useState, useEffect } from "react";

type FontSize = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export default function FontSizeAdjuster({
  onFontSizeChange,
}: {
  onFontSizeChange: (size: FontSize) => void;
}) {
  const [selectedSize, setSelectedSize] = useState<FontSize>(3);

  useEffect(() => {
    const saved = localStorage.getItem("flowsheetFontSize");
    if (saved) {
      const size = parseInt(saved) as FontSize;
      if (size >= 1 && size <= 7) {
        setSelectedSize(size);
        onFontSizeChange(size);
      }
    }
  }, [onFontSizeChange]);

  const handleClick = (size: FontSize) => {
    setSelectedSize(size);
    localStorage.setItem("flowsheetFontSize", size.toString());
    onFontSizeChange(size);
  };

  return (
    <div id="font-adjuster">
      {[1, 2, 3, 4, 5, 6, 7].map((size) => (
        <span
          key={size}
          className={`button ${selectedSize === size ? "fontSelected" : ""}`}
          id={`font-${size}`}
          onClick={() => handleClick(size as FontSize)}
          style={{
            cursor: "pointer",
            padding: "2px 8px",
            margin: "2px",
            display: "inline-block",
          }}
        >
          Aa
        </span>
      ))}
    </div>
  );
}
