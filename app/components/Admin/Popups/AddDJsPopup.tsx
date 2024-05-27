import React, { useState, useContext } from "react";

import {
    Box,
    Button,
    Checkbox,
    CircularProgress,
    FormControl,
    FormLabel,
    IconButton,
    Input,
    Sheet,
    Stack,
    Tab,
    TabList,
    TabPanel,
    Table,
    Tabs,
    Textarea,
    Tooltip,
    Typography,
} from "@mui/joy";
import { toast } from "sonner";
import { applicationSlice, useDispatch } from "@/lib/redux";

type AddDJsPopupProps = { };

/**
 * Represents a popup component for adding DJs.
 * Only accessible to station managers.
 *
 * @component
 * @category Station Management
 *
 * @param {Object} props - The component props.
 * @param {function} props.callback - The callback function to be executed after adding DJs.
 * @param {string} [props.style] - The style of the popup. Defaults to the success color.
 *
 * @returns {JSX.Element} The AddDJsPopup component.
 */
export const AddDJsPopup = (props: AddDJsPopupProps) => {

    const dispatch = useDispatch();
    const closePopup = dispatch(applicationSlice.actions.closePopup);
    const [loading, setLoading] = useState(false);

    const handleAddDJ = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const { username, email, password } = (event.target as HTMLFormElement).elements as AddDJFormElements;
        
        setLoading(true);

        setLoading(true);
        (async () => {
          //await createUser(username.value, email.value, password.value);
          setLoading(false);
          closePopup();
        })();
      }

      const handleAddDJs = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        setLoading(true);
        const { usernamesandemails, password } = (event.target as HTMLFormElement).elements as AddDJsFormElements;

        let entries = usernamesandemails.value.split('\n');
        let new_entries = entries.map((entry) => {
          let [username, email] = entry.split(',');
          return [username.trim(), email.trim()];
        });
        
        (async () => {
          /* await Promise.allSettled(
            new_entries.map((username, email) => createUser(username, email, password.value))
          ); */
          setLoading(false);
          closePopup();
        })();
      }

    return (
        <Sheet
        sx = {{
          minWidth: {
            xs: 'unset',
            sm: '400px',
            md: '600px',
          }
        }}
      >
      <Box sx={{ p: 2 }}>
        <Typography level="h1">Add DJs</Typography>
      </Box>
        <Tabs
          sx={{ mt: 2 }}
        >
        <TabList>
          <Tab value="manual">Add Manually</Tab>
          <Tab value="list">Add By List</Tab>
        </TabList>
        <TabPanel value="manual">
          <form
            onSubmit = {handleAddDJ}
          >
            <Stack spacing={2} sx = {{ p: 2 }}>
              <FormControl required>
                <FormLabel>Username</FormLabel>
                <Typography level = "body-sm" sx = {{ my: 0.5 }}>
                  This will be the username that the DJ uses to log in. It must be unique and cannot be changed. <br />
                  We recommend using the DJ's first name, last name, initials, or some combination of the three.
                </Typography>
                <Input
                  placeholder="username"
                  name = "username"
                />
              </FormControl>
              <FormControl required>
                <FormLabel>Email</FormLabel>
                <Typography level = "body-sm" sx = {{ my: 0.5 }}>
                  New users are notified of their account creation via email.
                </Typography>
                <Input
                  placeholder="email"
                  name = "email"
                />
              </FormControl>
              <FormControl required>
                <FormLabel>Temporary Password</FormLabel>
                <Typography level = "body-sm" sx = {{ my: 0.5 }}>
                  This password will be used to log in for the first time. The DJ will be prompted to change it upon logging in. <br />
                  <Typography color="primary">
                    Must contain at least 8 characters, 1 uppercase letter, 1 lowercase letter, and 1 number.
                  </Typography>
                </Typography>
                <Input
                  placeholder="password"
                  name = "password"
                />
              </FormControl>
              <FormControl>
                <Button
                  variant="solid"
                  color={"success"}
                  size="lg"
                  loading={loading}
                  type="submit"
                  sx = {{ my: 2, ml: 'auto' }}
                >
                  Create New Account
                </Button>
              </FormControl>
            </Stack>
          </form>
        </TabPanel>
        <TabPanel value="list">
          <form
            onSubmit = {handleAddDJs}
          >
            <Stack spacing={2} sx = {{ p: 2 }}>
              <FormControl required>
                <FormLabel>Enter List</FormLabel>
                <Typography level = "body-sm" sx = {{ my: 0.5 }}>
                  Enter a list of usernames and emails separated by <Typography color="primary">commas.</Typography> <br />
                  Every new entry should be on a <Typography color="primary">new line.</Typography> <br />
                  The usernames must be unique and cannot be changed. <br />
                  We recommend using the DJ's first name, last name, initials, or some combination of the three.
                </Typography>
                <Textarea
                  placeholder="username"
                  name = "usernames"
                  sx = {{ height: '100px' }}
                />
              </FormControl>
              <FormControl required>
                <FormLabel>Temporary Password</FormLabel>
                <Typography level = "body-sm" sx = {{ my: 0.5 }}>
                  This password will be used to log in for the first time. The DJs will be prompted to change it upon logging in. <br />
                  <Typography color="primary">
                    Must contain at least 8 characters, 1 uppercase letter, 1 lowercase letter, and 1 number.
                  </Typography>
                </Typography>
                <Input
                  placeholder="password"
                  name = "password"
                />
              </FormControl>
              <FormControl>
                <Button
                  variant="solid"
                  color={"success"}
                  size="lg"
                  loading={loading}
                  type="submit"
                  sx = {{ my: 2, ml: 'auto' }}
                >
                  Create New Accounts
                </Button>
              </FormControl>
            </Stack>
          </form>
        </TabPanel>
        </Tabs>
        </Sheet>
    )
}