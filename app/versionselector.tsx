"use client";

/* Components */

/* Instruments */
import { getClassicView, useSelector } from "@/lib/redux";
import "./styles/globals.css";

export interface PropsWithClassicView extends React.PropsWithChildren {
  classicChildren: React.ReactNode;
}

const VersionSelector = (props: PropsWithClassicView) => {
  const classicView = useSelector(getClassicView);

  if (classicView) return props.classicChildren;

  return props.children;
};

export default VersionSelector;
