"use client";

import { AppSkin, isValidAppSkin } from "./authentication/types";

export function setAppSkinCookie(appSkin: AppSkin) {
  document.cookie = `appSkin=${appSkin}; path=/; max-age=${60 * 60 * 24 * 365}`; // 1 year
}

export function getAppSkinCookie(): AppSkin | null {
  if (typeof document === "undefined") return null;
  
  const cookies = document.cookie.split(";");
  const appSkinCookie = cookies.find(cookie => 
    cookie.trim().startsWith("appSkin=")
  );
  
  if (appSkinCookie) {
    const value = appSkinCookie.split("=")[1];
    if (isValidAppSkin(value)) {
      return value;
    }
  }
  
  return null;
}

export function getAppSkinFromClient(): AppSkin {
  // Try cookie first, then default to modern
  return getAppSkinCookie() || "modern-light";
}
