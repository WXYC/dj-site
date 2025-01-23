"use client";

import { IconButton, Tooltip } from "@mui/joy";
import React from "react";

import { useRouter } from "next/navigation";

import {
  useGetClassicQuery,
  useToggleClassicMutation,
} from "@/lib/features/application/api";
import { AutoFixHigh, AutoFixOff } from "@mui/icons-material";
import { useEffect } from "react";

export function ThemeSwitchLoader() {
  return (
    <IconButton variant="soft" loading disabled>
      <AutoFixHigh />
    </IconButton>
  );
}

export default function ThemeSwitcher() {
  const router = useRouter();

  const { data: classic, isLoading } = useGetClassicQuery();
  const [toggleClassic, result] = useToggleClassicMutation();

  const handleSwitch = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    toggleClassic();
  };
  useEffect(() => {
    if (result.isSuccess) {
      router.refresh();
    }
  }, [result.isSuccess]);

  return (
    <Tooltip
      title={`Switch to ${classic ? "new" : "classic"} view`}
      size="sm"
      placement="bottom"
      variant="outlined"
    >
      <IconButton id="toggle-classic" onClick={handleSwitch} loading={isLoading} disabled={isLoading}>
        {classic ? <AutoFixHigh /> : <AutoFixOff />}
      </IconButton>
    </Tooltip>
  );
}
