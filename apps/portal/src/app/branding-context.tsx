"use client";

import { createContext, useContext } from "react";

import { fallbackSchoolBranding, type SchoolBranding } from "../lib/branding";

const SchoolBrandingContext = createContext<SchoolBranding>(fallbackSchoolBranding);

export function SchoolBrandingProvider({
  branding,
  children
}: Readonly<{
  branding: SchoolBranding;
  children: React.ReactNode;
}>) {
  return (
    <SchoolBrandingContext.Provider value={branding}>
      {children}
    </SchoolBrandingContext.Provider>
  );
}

export function useSchoolBranding() {
  return useContext(SchoolBrandingContext);
}
