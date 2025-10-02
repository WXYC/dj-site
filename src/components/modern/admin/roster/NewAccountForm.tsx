"use client";

import { adminSlice } from "@/lib/features/admin/frontend";
import { Authorization } from "@/lib/features/admin/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { PersonAdd } from "@mui/icons-material";
import { Button, ButtonGroup, Checkbox, Input, Select, Option } from "@mui/joy";
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
          <Select
            size="sm"
            value={authorizationOfNewAccount}
            onChange={(_, value) => {
              if (value !== null) {
                setAuthorizationOfNewAccount(value as Authorization);
              }
            }}
          >
            <Option value={Authorization.DJ}>DJ</Option>
            <Option value={Authorization.MD}>Music Director</Option>
            <Option value={Authorization.SM}>Station Management</Option>
          </Select>
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
            type="email"
            required
          />
        </td>
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
