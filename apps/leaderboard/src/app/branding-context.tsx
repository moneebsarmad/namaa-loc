"use client";

import { createContext, useContext } from "react";

import { fallbackSchoolBranding, type SchoolBranding } from "../lib/branding";
import type { SchoolHouseRecord } from "../lib/schoolHouses";

export type LeaderboardSchoolContextValue = {
  schoolId: string | null;
  branding: SchoolBranding;
  houses: SchoolHouseRecord[];
};

const fallbackLeaderboardContext: LeaderboardSchoolContextValue = {
  schoolId: null,
  branding: fallbackSchoolBranding,
  houses: []
};

const LeaderboardSchoolContext = createContext<LeaderboardSchoolContextValue>(
  fallbackLeaderboardContext
);

export function LeaderboardSchoolProvider({
  schoolId,
  branding,
  houses,
  children
}: Readonly<{
  schoolId: string | null;
  branding: SchoolBranding;
  houses: SchoolHouseRecord[];
  children: React.ReactNode;
}>) {
  return (
    <LeaderboardSchoolContext.Provider value={{ schoolId, branding, houses }}>
      {children}
    </LeaderboardSchoolContext.Provider>
  );
}

export function useLeaderboardSchoolContext() {
  return useContext(LeaderboardSchoolContext);
}

export function useLeaderboardBranding() {
  return useLeaderboardSchoolContext().branding;
}

export function useLeaderboardHouses() {
  return useLeaderboardSchoolContext().houses;
}

export function useLeaderboardSchoolId() {
  return useLeaderboardSchoolContext().schoolId;
}
