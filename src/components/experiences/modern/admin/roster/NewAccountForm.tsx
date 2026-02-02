"use client";

import { adminSlice } from "@/lib/features/admin/frontend";
import { Authorization } from "@/lib/features/admin/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { PersonAdd } from "@mui/icons-material";
import { Button, ButtonGroup, Checkbox, Input } from "@mui/joy";
import { ClickAwayListener } from "@mui/material";

export default function NewAccountForm() {
  const dispatch = useAppDispatch();

  const authorizationOfNewAccount = useAppSelector(
    adminSlice.selectors.getFormData
  ).authorization;
  const setAuthorizationOfNewAccount = (auth: Authorization) => {
    dispatch(adminSlice.actions.setFormData({ authorization: auth }));
  };

  return (
    <ClickAwayListener
      onClickAway={() => dispatch(adminSlice.actions.setAdding(false))}
    >
      <tr>
        <td
          style={{
            verticalAlign: "center",
            textAlign: "center",
          }}
        >
          <ButtonGroup>
            <Checkbox
              color="success"
              onChange={(e) => {
                if (e.target.checked) {
                  setAuthorizationOfNewAccount(Authorization.SM);
                } else {
                  setAuthorizationOfNewAccount(Authorization.DJ);
                }
              }}
              checked={authorizationOfNewAccount == Authorization.SM}
            />
            <Checkbox
              color="success"
              checked={
                authorizationOfNewAccount == Authorization.MD ||
                authorizationOfNewAccount == Authorization.SM
              }
              onChange={(e) => {
                if (e.target.checked) {
                  setAuthorizationOfNewAccount(Authorization.MD);
                } else {
                  setAuthorizationOfNewAccount(Authorization.DJ);
                }
              }}
              disabled={authorizationOfNewAccount == Authorization.SM}
            />
          </ButtonGroup>
        </td>
        <td>
          <Input
            name={"realName"}
            size="sm"
            color="success"
            placeholder="Name"
            autoFocus
            required
          />
        </td>
        <td>
          <Input
            name={"username"}
            size="sm"
            color="success"
            placeholder="Username"
            required
          />
        </td>
        <td>
          <Input
            name={"djName"}
            size="sm"
            color="success"
            placeholder="DJ Name (Optional)"
            required={false}
          />
        </td>
        <td>
          <Input
            name={"email"}
            size="sm"
            color="success"
            placeholder="Email"
            required
            type="email"
          />
        </td>
        <td>{/* Capabilities assigned after creation */}</td>
        <td
          style={{
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Button
            size="sm"
            color="success"
            startDecorator={<PersonAdd />}
            type="submit"
          >
            Save
          </Button>
        </td>
      </tr>
    </ClickAwayListener>
  );
}
