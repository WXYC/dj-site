import React, { useState } from "react";

const CLASSIC_Flowsheet = ({ logout }) => {
  const [releaseType, setReleaseType] = useState("libraryRelease");
  const [rotationType, setRotationType] = useState("heavy");

  const [notification, setNotification] = useState('');

  const OpenHelp = () => {
    console.log("Help!");
  };

  const toggleReleaseType = (event) => {
    setReleaseType(event.target.value);
  };

  const validate = () => {
    console.log("Validate!");
  };

  const toggleRotationDropdowns = (event) => {
    console.log(event.target.value);
  };

  const heavySelected = () => {
    console.log("Heavy selected!");
  };

  const lightSelected = () => {
    console.log("Light selected!");
  };

  const mediumSelected = () => {
    console.log("Medium selected!");
  };

  const singlesSelected = () => {
    console.log("Singles selected!");
  };

  const autofillComposerCheck = () => {
    console.log("Autofill composer check!");
  };

  const autofillComposerOnChange = () => {
    console.log("Autofill composer on change!");
  };

  const addTalkset = () => {
    console.log("Add talkset!");
  };

  const addBreakpoint = () => {
    console.log("Add breakpoint!");
  };

  return (
    <>
      <table cellpadding="2" align="center">
        <tbody>
          <tr>
            <td colSpan="4" className="label" align="center">
              <a href="#" onClick={addTalkset}>
                Add a Talkset!
              </a>{" "}
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              <a href="#" onClick={addBreakpoint}>
                Add a 3:00 AM Breakpoint
              </a>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{" "}
              <a href="#" target="_blank">
                Last 24 Hours{" "}
              </a>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              <a href="#" onClick={logout}>
                Sign Out When Finished!
              </a>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{" "}
              <a href="#" onClick={OpenHelp}>
                Help
              </a>
            </td>
          </tr>
        </tbody>
      </table>
      <hr />
      <form
        name="flowsheetEntry"
        method="POST"
        action="flowsheetEntryAdd"
        onSubmit={validate}
      >
        <input type="hidden" name="prevShowHide" value="show" />
        <input type="hidden" name="fontSize" value="3" />
        <input type="hidden" name="composerRequirement" value="no" />
        <table cellpadding="2" align="center">
          <tbody>
            <tr>
              <td colSpan="4" className="label" align="center"></td>
            </tr>
            <tr>
              <td
                colSpan="4"
                style={{ textAlign: "center", fontWeight: "bold" }}
                className="redlabel"
              >
                Add a track from:&nbsp;&nbsp;&nbsp;{" "}
                <input
                  type="radio"
                  name="releaseType"
                  value="rotationRelease"
                  onClick={toggleReleaseType}
                />
                &nbsp;Rotation&nbsp;{" "}
                <input
                  type="radio"
                  name="releaseType"
                  value="libraryRelease"
                  onClick={toggleReleaseType}
                  defaultChecked
                />
                &nbsp;WXYC Library&nbsp;{" "}
                <input
                  type="radio"
                  name="releaseType"
                  value="otherRelease"
                  onClick={toggleReleaseType}
                />
                &nbsp;Other&nbsp;
              </td>
            </tr>
          </tbody>
        </table>
        {releaseType == "rotationRelease" ? (
          <table cellpadding="5" align="center">
            <tr>
              <td
                id="rotationSelectionTD"
                style={{ fontWeight: "bold" }}
                className="redlabel"
              >
                <input
                  type="radio"
                  name="rotationType"
                  value="heavy"
                  onClick={toggleRotationDropdowns}
                  defaultChecked
                />
                H&nbsp;{" "}
                <input
                  type="radio"
                  name="rotationType"
                  value="medium"
                  onClick={toggleRotationDropdowns}
                />
                M&nbsp;
                <input
                  type="radio"
                  name="rotationType"
                  value="light"
                  onClick={toggleRotationDropdowns}
                />
                L&nbsp;{" "}
                <input
                  type="radio"
                  name="rotationType"
                  value="singles"
                  onClick={toggleRotationDropdowns}
                />
                S&nbsp;
              </td>
            </tr>
            <tr>
              <td id="releaseDropdownTD">
                <div id="rotationInstructionsLabel" className="label">
                  (Choose 'H' for Heavy, 'M' for Medium, 'L' for Light, or 'S'
                  for Singles)
                </div>
                {rotationType == "heavy" && (
                  <select name="heavyRelease" onChange={heavySelected}>
                    <option></option>
                  </select>
                )}
                {rotationType == "medium" && (
                  <select name="mediumRelease" onChange={mediumSelected}>
                    <option></option>
                  </select>
                )}
                {rotationType == "light" && (
                  <select name="lightRelease" onChange={lightSelected}>
                    <option></option>
                  </select>
                )}
                {rotationType == "singles" && (
                  <select name="singlesRelease" onChange={singlesSelected}>
                    <option></option>
                  </select>
                )}
              </td>
            </tr>
          </table>
        ) : (
          <table cellpadding="2" align="center">
            <tr id="blankArtistDisclaimerRow">
              <td colSpan="4" className="label">
                <div id="rotationDisclaimer" align="center">
                  <font size="-2">
                    Leave the 'Artist' field blank unless the record/CD is a
                    compilation or split release.{" "}
                  </font>
                </div>
              </td>
            </tr>
            <tr id="artistTextboxRow">
              <td className="redtitle" align="right">
                ARTIST:
              </td>
              <td colSpan="3" className="redtitle" valign="top" align="left">
                <input
                  type="text"
                  size="40"
                  name="artistName"
                  onChange={autofillComposerOnChange}
                />
              </td>
            </tr>
            <tr id="songTextboxRow">
              <td className="redtitle" align="right">
                SONG:
              </td>
              <td colSpan="3" className="redtitle" align="left" valign="top">
                <input type="text" size="50" name="songTitle" />
                <input
                  type="hidden"
                  name="rotationDropdownArtist"
                  value="rotationDropdownArtist"
                />
                <input type="hidden" name="radioShowID" value="162056" />
                <input type="hidden" name="workingHour" value="1686117600000" />
              </td>
            </tr>
            {releaseType == "otherRelease" && (
              <tr id="composerTextboxRow">
                <td className="redtitle" align="right">
                  COMPOSER:
                </td>
                <td colSpan="2" className="redtitle" valign="top" align="left">
                  <input type="text" size="50" name="bmiComposer" />
                  &nbsp;&nbsp;
                </td>
                <td className="label" valign="top">
                  <div id="autofillText" className="label">
                    Auto-fill 'COMPOSER' field with 'ARTIST' field?
                    <input
                      type="checkbox"
                      name="useArtistName"
                      onChange={autofillComposerCheck}
                    />
                  </div>
                </td>
              </tr>
            )}
            <tr id="regularReleaseRow" align="center">
              <td colSpan="4" className="label">
                <div id="rotationDisclaimer2" align="center">
                  <font size="-2">
                    'Release' and 'Label' are optional fields but listeners may
                    be interested in this information.{" "}
                  </font>
                </div>
                Release:&nbsp;
                <input type="text" size="60" name="releaseTitle" />
                &nbsp;&nbsp;&nbsp; Label:&nbsp;
                <input type="text" size="25" name="labelName" />
                &nbsp;&nbsp;&nbsp;
              </td>
            </tr>

            <tr id="requestSubmitRow" align="center">
              <td
                colSpan="4"
                style={{ textAlign: "center" }}
                className="redlabel"
              >
                Was this song a request?{" "}
                <input type="radio" name="requestAnswer" value="yes" />
                Yes &nbsp;{" "}
                <input type="radio" name="requestAnswer" value="no" checked />
                No &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{" "}
                <input
                  type="submit"
                  value="&#160;&#160;Add This Song To The Flowsheet&#160;&#160;"
                />
              </td>
            </tr>
            <tr id="blankRow2">
              <td colSpan="4"></td>
            </tr>
            <tr id="blankRow3">
              <td colSpan="4"></td>
            </tr>
            <tr id="blankRow4">
              <td colSpan="4"></td>
            </tr>
            <tr id="blankRow5">
              <td colSpan="4"></td>
            </tr>
          </table>
        )}
      </form>
      {(notification.length > 0) && (<><hr /><div className="redlabel" align="center">
        {notification}&nbsp;
      </div><hr /></>)}
      
      <div align="center">
        <table
          cellpadding="2"
          cellspacing="2"
          border="0"
          bgcolor="#AAAAAA"
          width="100%"
        >
          <tr>
            <th width="25%" style={{ textAlign: "left" }} className="redlabel">
              <font color="black">Date of Show:</font>&nbsp;6/7/23
              <br />
              <font color="black">Hours:</font>&nbsp;12:00 AM - 3:00 AM
            </th>
            <th>
              <div id="font-adjuster">
                <span className="button" id="font-1">
                  Aa
                </span>
                <span className="button" id="font-2">
                  Aa
                </span>
                <span className="button" id="font-3">
                  Aa
                </span>
                <span className="button" id="font-4">
                  Aa
                </span>
                <span className="button" id="font-5">
                  Aa
                </span>
                <span className="button" id="font-6">
                  Aa
                </span>
                <span className="button" id="font-7">
                  Aa
                </span>
              </div>
            </th>
            <th
              width="25%"
              bgcolor="#AAAAAA"
              style={{ textAlign: "center" }}
              className="redlabel"
            >
              <font color="black">Disc Jockey:</font>&nbsp;Jackson Meade&nbsp;
            </th>
          </tr>
        </table>
        <div id="flowsheet">
          <table cellpadding="4" cellspacing="2" border="0" width="100%">
            <tr>
              <th>Playlist</th>
              <th>Req.</th>
              <th width="25%">Artist</th>
              <th>Song</th>
              <th>Release</th>
              <th>Label</th>
              <th colSpan="2">
                Move Up
                <br />
                or Down?
              </th>
              <th>Edit/Delete</th>
            </tr>
          </table>
        </div>
      </div>
    </>
  );
};

export default CLASSIC_Flowsheet;
