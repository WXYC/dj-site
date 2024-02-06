'use client';

import { Album, FlowSheetEntry, FlowSheetEntryProps, Rotation, authenticationSlice, flowSheetSlice, getAuthenticatedUser, getEntries, getIsLive, getQueue, isLive, join, leave, loadFlowsheet, processingLive, useDispatch } from "@/lib/redux";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";

import NorthIcon from '@mui/icons-material/North';
import SouthIcon from '@mui/icons-material/South';
import { Box } from "@mui/joy";
import { toast } from "sonner";

const ClassicFlowsheetPage = (): JSX.Element => {

  const dispatch = useDispatch();

  const [fontSizeSetting, setFontSizeSetting] = useState(2);

  useEffect(() => {
    // make the html data-attribute reflect the font size setting
    document.documentElement.setAttribute('data-classic-font-size', fontSizeSetting.toString());
  }, [fontSizeSetting]);

  const logout = (e: any) => dispatch(authenticationSlice.actions.logout());
  const user = useSelector(getAuthenticatedUser);

  useEffect(() => {
    dispatch(loadFlowsheet());
  }, []);

  useEffect(() => {
    dispatch(getIsLive(user?.djId));
  }, [user?.djId]);

  const live = useSelector(isLive);
  const intermediate = useSelector(processingLive);
  const goLive = useCallback(() => {

    if (!user?.djId) {
      return;
    }

    dispatch(join({
      dj_id: user?.djId,
    }));

  }, [user?.djId]);

  const goOff = useCallback(() => {

    if (!user?.djId) {
      return;
    }

    dispatch(leave({
      dj_id: user?.djId,
    }));

  }, [user?.djId]);

  const entries = useSelector(getEntries);
  const addToEntries = (entry: FlowSheetEntryProps) => dispatch(flowSheetSlice.actions.addToEntries(entry));
  const removeFromEntries = (id: number) => dispatch(flowSheetSlice.actions.removeFromEntries(id));
  const switchEntry = (id1: number, id2: number) => dispatch(flowSheetSlice.actions.switchEntry({ id1, id2 }));

  const formRef = useRef<HTMLFormElement>(null);

  const [rotationType, setRotationType] = useState<Rotation>("H");
  const [notification, setNotification] = useState('');

  const OpenHelp = () => {
    console.log("Help!");
  };

  const [releaseType, setReleaseType] = useState("libraryRelease");
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
          artist: e.target.artist.value,
          title: e.target.title.value,
          label: e.target.label.value,
          album: e.target.album.value,
        };
        addToEntries({ message: "", ...libraryRelease });
        formRef.current?.reset();
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
    addToEntries({ message: "Talkset" });
  };

  const addBreakpoint = () => {
    console.log("Add breakpoint!");
  };

  return live ? (
    <Box>
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
                  value="H"
                  onClick={toggleRotationDropdowns}
                  defaultChecked
                />
                H&nbsp;{" "}
                <input
                  type="radio"
                  name="rotationType"
                  value="M"
                  onClick={toggleRotationDropdowns}
                />
                M&nbsp;
                <input
                  type="radio"
                  name="rotationType"
                  value="L"
                  onClick={toggleRotationDropdowns}
                />
                L&nbsp;{" "}
                <input
                  type="radio"
                  name="rotationType"
                  value="S"
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
                {rotationType == "H" && (
                  <select name="heavyRelease" onChange={heavySelected}>
                    <option></option>
                  </select>
                )}
                {rotationType == "M" && (
                  <select name="mediumRelease" onChange={mediumSelected}>
                    <option></option>
                  </select>
                )}
                {rotationType == "L" && (
                  <select name="lightRelease" onChange={lightSelected}>
                    <option></option>
                  </select>
                )}
                {rotationType == "S" && (
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
                <div id="rotationDisclaimer" >
                  <span style = {{ fontSize: "0.7rem" }}>
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
            <tr id="regularReleaseRow" >
              <td colSpan={4} className="label">
                <div id="rotationDisclaimer2" >
                  <span style = {{ fontSize: "0.7rem" }}>
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

            <tr id="requestSubmitRow" >
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
      {(notification.length > 0) && (<><hr /><div className="redlabel" >
        {notification}&nbsp;
      </div><hr /></>)}
      
      <div >
        <table
          cellPadding="2"
          cellSpacing="2"
          border={0}
          style = {{ background: "#AAAAAA" }}
          width="100%"
        >
          <tr>
            <th style={{ textAlign: "left", width: "25%" }} className="redlabel">
              <span color="black">Date of Show:</span>&nbsp;6/7/23
              <br />
              <span color="black">Hours:</span>&nbsp;12:00 AM - 3:00 AM
            </th>
            <th>
              <div id="font-adjuster">
              {[...Array(7)].map((_, index) => (
                <button
                  key={index}
                  className={`fontButton ${(fontSizeSetting === index + 1) ? 'active' : ''}`}
                  onClick={() => setFontSizeSetting(index + 1)}
                  id={`font-${index + 1}`}
                >
                  Aa
                </button>
              ))}
              </div>
            </th>
            <th
              style={{ textAlign: "center", width: "25%", background: "#AAAAAA" }}
              className="redlabel"
            >
              <span color="black">Disc Jockey:</span>&nbsp;{user?.name}&nbsp;
            </th>
          </tr>
        </table>
        <div id="flowsheet">
          <table cellPadding="4" cellSpacing="2" border={0} width="100%">
            <tr>
              <th>Playlist</th>
              <th>Req.</th>
              <th style = {{width:"25%"}}>Artist</th>
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
              entries.map((entry: FlowSheetEntry, index) => ((entry.message == "" || !entry.message) ? (
                <tr style = {{background:"#F3F3F3"}} className="flowsheetEntryData">
                <td align="center"></td>
                <td align="center"></td>
                <td align="left">{entry?.song?.album?.artist.name}</td>
                <td align="left">{entry?.song?.title}</td>
                <td align="left">{entry?.song?.album?.title}</td>
                <td align="left">{(() => {
                    let album = entry?.song?.album as Album
                    return album?.label
                  })()}</td>
                <td align="center" className="text">
                  <a href="" onClick={(e) => {
                    e.preventDefault();
                    if (entry.id === 0) return;
                    switchEntry(entry.id - 1, entry.id);
                  }}>
                    <img src="/img/icons/up.png" style = {{ height: '1.5rem' }} />
                  </a>
                </td>
                <td align="center" className="text">
                  <a href="" onClick={(e) => {
                    e.preventDefault();
                    if (entry.id === entries.length - 1) return;
                    switchEntry(entry.id + 1, entry.id);
                  }}>
                    <img src="/img/icons/down.png" style = {{ height: '1.5rem' }} />
                  </a>
                </td>
                <td align="center" className="text">
                  <a href="javascript:modEntry(2285301)">Edit</a>&nbsp;&nbsp; 
                  <a href='' onClick={(e) => { e.preventDefault(); removeFromEntries(entry.id); }}>Delete</a>
                </td>
              </tr>
              ) : (() => {
                let type = entry.message.includes("left") || entry.message.includes("joined"); // true for starting/leaving show, false for other messages
                return type ? (
                  <tr style = {{ background: "#999999" }} className="flowsheetEntryData">
                    <td colSpan={8} align="left" className="redlabel">--- {entry.message} ---</td>
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
                <tr style = {{ background: "#BBBBBB" }} className="flowsheetEntryData">
                <td colSpan={6} align="center" className="redlabel">{entry.message}</td>
                <td align="center" className="text">
                  <a href="javascript:moveEntryUp(2285297, 36, 37)">
                    <img src="/img/icons/up.png" style = {{ height: '1.5rem' }} />
                  </a>
                </td>
                <td align="center" className="text">
                  <a href="javascript:moveEntryDown(2285297, 36, 35)">
                    <img src="/img/icons/down.png" style = {{ height: '1.5rem' }} />
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
    </Box>
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

export default ClassicFlowsheetPage;