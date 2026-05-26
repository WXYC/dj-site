"use client";

import { Tab, TabList, TabPanel, Tabs } from "@mui/joy";
import type { ReactNode } from "react";

export type CatalogEditTab = "artist" | "album" | "rotation";

const TAB_LABELS: Record<CatalogEditTab, string> = {
  artist: "Artist",
  album: "Album",
  rotation: "Rotation",
};

const TABS = Object.keys(TAB_LABELS) as CatalogEditTab[];

type CatalogEntryFormTabsProps = {
  activeTab: CatalogEditTab;
  onTabChange: (tab: CatalogEditTab) => void;
  artistPanel: ReactNode;
  albumPanel: ReactNode;
  rotationPanel: ReactNode;
};

export default function CatalogEntryFormTabs({
  activeTab,
  onTabChange,
  artistPanel,
  albumPanel,
  rotationPanel,
}: CatalogEntryFormTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onChange={(_, value) => onTabChange(value as CatalogEditTab)}
      sx={{ width: "100%" }}
    >
      <TabList
        aria-label="Edit catalog entry sections"
        variant="soft"
        color="neutral"
        size="sm"
        sx={{
          width: "100%",
          p: 0.25,
          gap: 0.5,
          borderRadius: "lg",
          bgcolor: "background.level1",
          boxShadow: "sm",
          mb: 2,
        }}
      >
        {TABS.map((tab) => (
          <Tab
            key={tab}
            value={tab}
            disableIndicator
            sx={{
              flex: 1,
              borderRadius: "md",
              fontWeight: activeTab === tab ? "lg" : "md",
            }}
            data-testid={`catalog-edit-tab-${tab}`}
          >
            {TAB_LABELS[tab]}
          </Tab>
        ))}
      </TabList>
      <TabPanel value="artist" sx={{ p: 0 }} data-testid="catalog-edit-tab-artist">
        {artistPanel}
      </TabPanel>
      <TabPanel value="album" sx={{ p: 0 }} data-testid="catalog-edit-tab-album">
        {albumPanel}
      </TabPanel>
      <TabPanel value="rotation" sx={{ p: 0 }} data-testid="catalog-edit-tab-rotation">
        {rotationPanel}
      </TabPanel>
    </Tabs>
  );
}
