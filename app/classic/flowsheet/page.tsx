'use client';

import { useRef, useState } from "react";

import { FlowSheetEntry, authenticationSlice, flowSheetSlice, getAuthenticatedUser, getCurrentUser, getFlowSheet, isLive, useDispatch } from "@/lib/redux";
import NorthIcon from '@mui/icons-material/North';
import SouthIcon from '@mui/icons-material/South';
import { useSelector } from "react-redux";

const CLASSIC_Flowsheet = (props: React.PropsWithChildren) => {
  
    const dispatch = useDispatch();

  const [releaseType, setReleaseType] = useState("libraryRelease");
  const [rotationType, setRotationType] = useState("heavy");

  const [notification, setNotification] = useState('');

  const live = useSelector(isLive);
  const goLive = () => dispatch(flowSheetSlice.actions.setLive(true));
  const goOff = () => dispatch(flowSheetSlice.actions.setLive(false));

  const logout = () => dispatch(authenticationSlice.actions.logout());

  const entries = useSelector(getFlowSheet);
  const addToEntries = (item: FlowSheetEntry) => dispatch(flowSheetSlice.actions.addToFlowSheet(item));
  const removeFromEntries = (id: number) => dispatch(flowSheetSlice.actions.removeFromFlowSheet(id));
  // TODO: Switch entry
  const switchEntry = (id: number, id2: number) => null;

  const user = useSelector(getAuthenticatedUser);

  const formRef = useRef<any>();

  const OpenHelp = () => {
    console.log("Help!");
  };

const toggleReleaseType = (event: any) => {
    setReleaseType(event.target.value);
  };

  const validate = (e: any) => {
    e.preventDefault();
    // Now get all form elements
    switch(releaseType) {
      case "libraryRelease":
        // get all form elements for library release
        const libraryRelease = {
          id: -1,
        };
        addToEntries({ message: "", ...libraryRelease });
        formRef.current.reset();
      break;
      default:
        console.log("Non-configured release type!");
        return;
    }
  };

  const toggleRotationDropdowns = (event: any) => {
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

  const addTalkset = (e: any) => {
    e.preventDefault();
    addToEntries({ id: -1, message: "Talkset" });
  };

  const addBreakpoint = () => {
    console.log("Add breakpoint!");
  };

  return live ? (
    <>
      <table cellPadding="2" align="center">
        <tbody>
          <tr>
            <td colSpan={4} className="label" align="center">
              <a href="" onClick={addTalkset}>
                Add a Talkset!
              </a>{" "}
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              <a href="" onClick={addBreakpoint}>
                Add a 3:00 AM Breakpoint
              </a>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{" "}
              <a href="" target="_blank">
                Last 24 Hours{" "}
              </a>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              <a href="" onClick={logout}>
                Sign Out When Finished!
              </a>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{" "}
              <a href="" onClick={OpenHelp}>
                Help
              </a>
            </td>
          </tr>
        </tbody>
      </table>
      <hr />
      <form
        name="flowsheetEntry"
        onSubmit={validate}
        ref={formRef}
      >
        <table cellPadding="2" align="center">
          <tbody>
            <tr>
              <td colSpan={4} className="label" align="center"></td>
            </tr>
            <tr>
              <td
                colSpan={4}
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
          <table cellPadding="5" align="center">
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
          <table cellPadding="2" align="center">
            <tr id="blankArtistDisclaimerRow">
              <td colSpan={4} className="label">
                <div id="rotationDisclaimer">
                  <span>
                    Leave the 'Artist' field blank unless the record/CD is a
                    compilation or split release.{" "}
                  </span>
                </div>
              </td>
            </tr>
            <tr id="artistTextboxRow">
              <td className="redtitle" align="right">
                ARTIST:
              </td>
              <td colSpan={3} className="redtitle" valign="top" align="left">
                <input
                  type="text"
                  size={40}
                  name="artist"
                  onChange={autofillComposerOnChange}
                />
              </td>
            </tr>
            <tr id="songTextboxRow">
              <td className="redtitle" align="right">
                SONG:
              </td>
              <td colSpan={3} className="redtitle" align="left" valign="top">
                <input type="text" size={50} name="title" />
              </td>
            </tr>
            {releaseType == "otherRelease" && (
              <tr id="composerTextboxRow">
                <td className="redtitle" align="right">
                  COMPOSER:
                </td>
                <td colSpan={2} className="redtitle" valign="top" align="left">
                  <input type="text" size={50} name="bmiComposer" />
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
            <tr id="regularReleaseRow">
              <td colSpan={4} className="label">
                <div id="rotationDisclaimer2">
                  <span>
                    'Release' and 'Label' are optional fields but listeners may
                    be interested in this information.{" "}
                  </span>
                </div>
                Release:&nbsp;
                <input type="text" size={60} name="album" />
                &nbsp;&nbsp;&nbsp; Label:&nbsp;
                <input type="text" size={25} name="label" />
                &nbsp;&nbsp;&nbsp;
              </td>
            </tr>

            <tr id="requestSubmitRow">
              <td
                colSpan={4}
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
              <td colSpan={4}></td>
            </tr>
            <tr id="blankRow3">
              <td colSpan={4}></td>
            </tr>
            <tr id="blankRow4">
              <td colSpan={4}></td>
            </tr>
            <tr id="blankRow5">
              <td colSpan={4}></td>
            </tr>
          </table>
        )}
      </form>
      {(notification.length > 0) && (<><hr /><div className="redlabel">
        {notification}&nbsp;
      </div><hr /></>)}
      
      <div>
        <table
          cellPadding="2"
          cellSpacing="2"
          border={0}
          bgcolor="#AAAAAA"
          width="100%"
        >
          <tr>
            <th style={{ width: "25%", textAlign: "left" }} className="redlabel">
              <span style={{ color: "black" }}>Date of Show:</span>&nbsp;6/7/23
              <br />
              <span style={{ color: "black" }}>Hours:</span>&nbsp;12:00 AM - 3:00 AM
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
              style={{ background: "#AAAAAA", width: "25%", textAlign: "center" }}
              className="redlabel"
            >
              <span style={{ color: "black" }}>Disc Jockey:</span>&nbsp;{user?.djName}&nbsp;
            </th>
          </tr>
        </table>
        <div id="flowsheet">
          <table cellPadding={4} cellSpacing="2" border={0} width="100%">
            <tr>
              <th>Playlist</th>
              <th>Req.</th>
              <th style={{ width: "25%" }}>Artist</th>
              <th>Song</th>
              <th>Release</th>
              <th>Label</th>
              <th colSpan={2}>
                Move Up
                <br />
                or Down?
              </th>
              <th>Edit/Delete</th>
            </tr>
            {
              entries.flowSheet.map((entry: FlowSheetEntry, index: number) => ((entry.message == "") ? (
                <tr style={{ background:"#F3F3F3" }} className="flowsheetEntryData">
                <td align="center"></td>
                <td align="center"></td>
                <td align="left">{entry.song?.album?.artist.name}</td>
                <td align="left">{entry.song?.title}</td>
                <td align="left">{entry.song?.album?.title}</td>
                <td align="left">{entry.song?.album?.label}</td>
                <td align="center" className="text">
                  <a href="" onClick={(e) => {
                    e.preventDefault();
                    if (entry.id === 0) return;
                    switchEntry(entry.id - 1, entry.id);
                  }}>
                    <NorthIcon />
                  </a>
                </td>
                <td align="center" className="text">
                  <a href="" onClick={(e) => {
                    e.preventDefault();
                    if (entry.id === entries.flowSheet.length - 1) return;
                    switchEntry(entry.id + 1, entry.id);
                  }}>
                    <SouthIcon />
                  </a>
                </td>
                <td align="center" className="text">
                  <a href="javascript:modEntry(2285301)">Edit</a>&nbsp;&nbsp; 
                  <a href='' onClick={(e) => { e.preventDefault(); removeFromEntries(entry.id); }}>Delete</a>
                </td>
              </tr>
              ) : (() => {
                let type = entry?.message?.includes("left") || entry?.message?.includes("joined"); // true for starting/leaving show, false for other messages
                return type ? (
                  <tr style={{ background: "#444444" }} className="flowsheetEntryData">
                    <td colSpan={8} align="left" className="littlegreenlabel">{entry.message}</td>
                    <td align="center" className="text">
                    <a href=""
                    onClick={(e) => {
                      e.preventDefault();
                      removeFromEntries(entry.id);
                    }}
                  >
                    Delete
                  </a></td>
                  </tr>
                ) : 
                (
                <tr style={{ background: "#BBBBBB" }} className="flowsheetEntryData">
                <td colSpan={6} align="center" className="redlabel">{entry.message}</td>
                <td align="center" className="text">
                  <a href="javascript:moveEntryUp(2285297, 36, 37)">
                    <NorthIcon />
                  </a>
                </td>
                <td align="center" className="text">
                  <a href="javascript:moveEntryDown(2285297, 36, 35)">
                    <SouthIcon />
                  </a>
                </td>
                <td align="center" className="text">
                  <a href=""
                    onClick={(e) => {
                      e.preventDefault();
                      removeFromEntries(entry.id);
                    }}
                  >
                    Delete
                  </a>
                </td>
              </tr>
              )})()))
            }
          </table>
        </div>
      </div>
    </>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '50vh', justifyContent: 'center', alignItems: 'center' }}>
        <img src = '/img/wxyc-logo-classic.gif' />
        <p>Welcome, DJ Turncoat</p>
        <button onClick={() => {
          goLive();
        }} className="button">Sign On and Start the Show!</button>
    </div>
  );
};

export default CLASSIC_Flowsheet;
