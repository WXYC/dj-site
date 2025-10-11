"use client";

import { adminSlice } from "@/lib/features/admin/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { Close, Troubleshoot } from "@mui/icons-material";
import { Button, FormControl, Input } from "@mui/joy";

export default function AccountSearchForm() {
  const searchString = useAppSelector(adminSlice.selectors.getSearchString);

  const dispatch = useAppDispatch();
  const setSearchString = (value: string) =>
    dispatch(adminSlice.actions.setSearchString(value));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <FormControl>
        <Input
          color={"success"}
          size="sm"
          sx={{ minWidth: "400px" }}
          placeholder="Search Roster"
          startDecorator={<Troubleshoot />}
          endDecorator={
            searchString.length > 0 && (
              <Button
                variant="plain"
                color={"success"}
                size="sm"
                onClick={() => {
                  setSearchString("");
                }}
                sx={{
                  px: 0.5,
                }}
              >
                <Close />
              </Button>
            )
          }
          value={searchString}
          onChange={(e) => {
            setSearchString(e.target.value);
          }}
        />
      </FormControl>
    </form>
  );
}
