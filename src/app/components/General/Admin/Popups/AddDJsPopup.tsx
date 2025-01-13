"use client";
import React, { useState } from "react";

import { useAppDispatch } from "@/lib/hooks";
import { addDJ, Authority, fetchDJs, populateAdmins } from "@/lib/models";
import { applicationSlice } from "@/lib/slices/application/slice";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  ModalClose,
  Sheet,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Textarea,
  Typography,
} from "@mui/joy";
import { Popup, PopupProps } from "../../Popups/Popups";

export const AddDJsPopup = (props: PopupProps) => {
  const dispatch = useAppDispatch();
  const close = () =>
    dispatch(applicationSlice.actions.closePopup(props.uniqueId));
  const [loading, setLoading] = useState(false);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [tempPassword, setTempPassword] = useState("");

  const createUser = async (
    username: string,
    email: string,
    password: string
  ) => {
    await dispatch(
      addDJ({
        dj: {
          username: username,
          name: "Anonymous",
          djName: "WXYC",
          email: email,
          authority: Authority.DJ,
        },
        temporaryPassword: password,
      })
    );
  };

  const handleAddDJ = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { username, email, password } = (event.target as HTMLFormElement)
      .elements as AddDJFormElements;

    setLoading(true);

    (async () => {
      await createUser(username.value, email.value, password.value);
      setLoading(false);
    })().finally(() => {
      dispatch(fetchDJs())
        .then(() => {
          dispatch(populateAdmins());
        })
        .then(() => {
          close();
        });
    });
  };

  const handleAddDJs = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setLoading(true);
    const { usernamesandemails, password } = (event.target as HTMLFormElement)
      .elements as AddDJsFormElements;

    let entries = usernamesandemails.value.split("\n");
    let new_entries = entries.map((entry) => {
      let [username, email] = entry.split(",");
      return {
        userName: username.trim(),
        email: email.trim(),
      };
    });

    (async () => {
      await Promise.allSettled(
        new_entries.map((entry) =>
          createUser(entry.userName, entry.email, password.value)
        )
      );
      setLoading(false);
    })().finally(() => {
      dispatch(fetchDJs())
        .then(() => {
          dispatch(populateAdmins());
        })
        .then(() => {
          close();
        });
    });
  };

  return (
    <Popup {...props}>
      <Sheet
        sx={{
          minWidth: {
            xs: "unset",
            sm: "400px",
            md: "600px",
          },
        }}
      >
        <ModalClose />
        <Box sx={{ p: 2 }}>
          <Typography level="h1">Add DJs</Typography>
        </Box>
        <Tabs sx={{ mt: 2 }} defaultValue={"manual"}>
          <TabList>
            <Tab value="manual">Add Manually</Tab>
            <Tab value="list">Add By List</Tab>
          </TabList>
          <TabPanel value="manual">
            <form onSubmit={handleAddDJ}>
              <Stack spacing={2} sx={{ p: 2 }}>
                <FormControl required>
                  <FormLabel>Username</FormLabel>
                  <Typography level="body-sm" sx={{ my: 0.5 }}>
                    This will be the username that the DJ uses to log in.{" "}
                    <Typography color="primary">
                      It must be unique and cannot be changed.
                    </Typography>{" "}
                    <br />
                    We recommend using the DJ&apos;s onyen, first name, last
                    name, initials, or some combination thereof.
                  </Typography>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="username"
                    name="username"
                  />
                </FormControl>
                <FormControl required>
                  <FormLabel>Email</FormLabel>
                  <Typography level="body-sm" sx={{ my: 0.5 }}>
                    New users are notified of their account creation via email.
                  </Typography>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email"
                    name="email"
                  />
                </FormControl>
                <FormControl required>
                  <FormLabel>Temporary Password</FormLabel>
                  <Typography level="body-sm" sx={{ my: 0.5 }}>
                    This password will be used to log in for the first time. The
                    DJ will be prompted to change it upon logging in. <br />
                    <Typography color="primary">
                      Must contain at least 8 characters, 1 uppercase letter, 1
                      lowercase letter, and 1 number.
                    </Typography>
                  </Typography>
                  <Input
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    placeholder="password"
                    name="password"
                  />
                </FormControl>
                <FormControl>
                  <Button
                    variant="solid"
                    color={"success"}
                    size="lg"
                    loading={loading}
                    type="submit"
                    sx={{ my: 2, ml: "auto" }}
                    disabled={
                      !username ||
                      !email ||
                      !tempPassword ||
                      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/.test(
                        tempPassword
                      )
                    }
                  >
                    Create New Account
                  </Button>
                </FormControl>
              </Stack>
            </form>
          </TabPanel>
          <TabPanel value="list">
            <form onSubmit={handleAddDJs}>
              <Stack spacing={2} sx={{ p: 2 }}>
                <FormControl required>
                  <FormLabel>Enter List</FormLabel>
                  <Typography level="body-sm" sx={{ my: 0.5 }}>
                    Enter a list of usernames and emails separated by{" "}
                    <Typography color="primary">commas.</Typography> <br />
                    Every new entry should be on a{" "}
                    <Typography color="primary">new line.</Typography> <br />
                    The usernames must be unique and{" "}
                    <Typography color="primary">
                      cannot be changed.
                    </Typography>{" "}
                    <br />
                    We recommend using the DJ&apos;s onyen, first name, last
                    name, initials, or some combination thereof.
                  </Typography>
                  <Textarea
                    placeholder="username"
                    name="usernames"
                    sx={{ height: "100px" }}
                  />
                </FormControl>
                <FormControl required>
                  <FormLabel>Temporary Password</FormLabel>
                  <Typography level="body-sm" sx={{ my: 0.5 }}>
                    This password will be used to log in for the first time. The
                    DJs will be prompted to change it upon logging in. <br />
                    <Typography color="primary">
                      Must contain at least 8 characters, 1 uppercase letter, 1
                      lowercase letter, and 1 number.
                    </Typography>
                  </Typography>
                  <Input placeholder="password" name="password" />
                </FormControl>
                <FormControl>
                  <Button
                    variant="solid"
                    color={"success"}
                    size="lg"
                    loading={loading}
                    type="submit"
                    sx={{ my: 2, ml: "auto" }}
                  >
                    Create New Accounts
                  </Button>
                </FormControl>
              </Stack>
            </form>
          </TabPanel>
        </Tabs>
      </Sheet>
    </Popup>
  );
};
