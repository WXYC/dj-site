"use client";

import { adminSlice } from "@/lib/features/admin/frontend";
import { Authorization, ROSTER_ROLES } from "@/lib/features/admin/types";
import { AUTHORIZATION_LABELS } from "@/lib/features/authentication/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { ClickAwayListener } from "@mui/base/ClickAwayListener";
import { PersonAdd } from "@mui/icons-material";
import { Button, FormControl, Input, Option, Select } from "@mui/joy";

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
        <td style={{ verticalAlign: "middle" }}>
          <FormControl size="sm">
            <Select
              size="sm"
              color="success"
              value={authorizationOfNewAccount}
              onChange={(_, newValue) => {
                if (newValue !== null) setAuthorizationOfNewAccount(newValue as Authorization);
              }}
              slotProps={{ button: { sx: { whiteSpace: "nowrap" } } }}
            >
              {ROSTER_ROLES.map((role) => (
                <Option key={role} value={role}>
                  {AUTHORIZATION_LABELS[role]}
                </Option>
              ))}
            </Select>
          </FormControl>
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
