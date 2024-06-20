"use client";
import AuthenticationGuard from "@/app/components/Authentication/AuthenticationGuard";
import { getAuthenticatedUser, useDispatch, useSelector } from "@/lib/redux";
import { prefix } from "@/utils/prefix";
import React, { useState } from "react";

const ClassicCatalogPage = () => {
  const dispatch = useDispatch();

  const user = useSelector(getAuthenticatedUser);

  const [searchTimeout, setSearchTimeout] = useState<
    NodeJS.Timeout | undefined
  >(undefined);

  const [localSearchString, setLocalSearchString] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    alert("Search submitted!");
  };

  return (
    <div>
      <AuthenticationGuard redirectTo="/login" savePath />
      <form onSubmit={handleSubmit}>
        <div>
          <table
            cellPadding="5"
            cellSpacing={1}
            border={0}
            style={{ width: "75%" }}
            align="center"
          >
            <tr>
              <td align="center" valign="top">
                <span className="title">Search the&nbsp;&nbsp;</span>
                <img
                  src={`${prefix}/wxyc-logo-classic.gif`}
                  alt="WXYC logo"
                  style={{ border: 0 }}
                />
                <span className="title">&nbsp;&nbsp;Library:</span>
              </td>
            </tr>
            <tr>
              <td align="center">
                <input
                  type="text"
                  name="localSearchString"
                  size={60}
                  value={localSearchString}
                  onChange={(e) => {
                    e.preventDefault();
                    setLocalSearchString(e.target.value);
                  }}
                />
              </td>
            </tr>
            <tr>
              <td align="center">
                <input
                  type="submit"
                  value="&#160;&#160;Search the WXYC Library!&#160;&#160;"
                />
                &nbsp;&nbsp;&nbsp;&nbsp;
                <input type="reset" value="Clear Box" />
              </td>
            </tr>
            <tr>
              <td align="center">
                <span className="text"></span>
              </td>
            </tr>
            <tr>
              <td align="center">
                <span className="smalltext">
                  Program last modified: February 2, 2024.
                </span>
              </td>
            </tr>
            <tr>
              <td align="center">
                <span className="text">
                  56,000+ total releases in this database.
                </span>
              </td>
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
};

export default ClassicCatalogPage;
