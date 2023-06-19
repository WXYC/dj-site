import React, {useState} from "react";
import { Alert, Box, Button, CircularProgress, FormControl, FormHelperText, FormLabel, Input, Stack, Typography } from "@mui/joy";
import { updateUserAttributes } from "../../services/settings/settingsFunctions";
import { toast } from "sonner";

const SettingsPage = ({
    forceUpdate,
    djName,
    username,
    name,
}) => {

    const [nameValue, setNameValue] = useState(name);
    const [nameLoading, setNameLoading] = useState(false);

    const handleNameSubmit = (event) => {
        event.preventDefault();
        setNameLoading(true);

        updateUserAttributes({
            name: event.target.name.value,
        }).then(() => {
            forceUpdate();
        }).catch((error) => {
            toast.error(error.toString());
            setNameValue(name);
        }).finally(() => {
            setTimeout(() => {
                setNameLoading(false);
            }, 1000); // a little delay to prevent flashing
        });

    }

    const [passwordLoading, setPasswordLoading] = useState(false);

    const handlePasswordSubmit = (event) => {

        event.preventDefault();
        setPasswordLoading(true);
    }

    const [djNameValue, setDJNameValue] = useState(djName);
    const [djNameLoading, setDJNameLoading] = useState(false);

    const handleDJNameSubmit = async (event) => {
        event.preventDefault();
        setDJNameLoading(true);
        
        await updateUserAttributes({
            'custom:dj-name': event.target.djName.value,
        }).then(() => {
            forceUpdate();
        }).catch((error) => {
            toast.error(error.toString());
            setDJNameValue(djName);
        }).finally(() => {
            setTimeout(() => {
                setDJNameLoading(false);
            }, 1000); // a little delay to prevent flashing
        });
    }

    return (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              my: 1,
              gap: 1,
              flexWrap: 'wrap',
              '& > *': {
                minWidth: 'clamp(0px, (500px - 100%) * 999, 100%)',
                flexGrow: 1,
              },
            }}
          >
            <Typography level="h1">
              Settings
            </Typography>
            <Box sx = {{ flex: 999 }}></Box>
        </Box>
        <iframe src={`../#/CallingCard?dj=Turncoat`} style={{border: '0px', width: '320px', height: '400px', overflow: 'hidden' }} />
        <iframe src={`../#/NowPlaying`} style={{border: '0px', width: '320px', height: '400px', overflow: 'hidden' }} />
        <form
            onSubmit={handlePasswordSubmit}
        >
            <Stack
                direction="row"
                spacing={2}
            >
                <FormControl>
                    <FormLabel>
                        Username
                    </FormLabel>
                    <Input
                        name="username"
                        placeholder={username}
                        disabled={true}
                        color="warning"
                    />
                </FormControl>
                <FormControl
                    sx = {{
                        flex: 1,
                    }}
                >
                    <FormLabel>
                        Change Password
                    </FormLabel>
                    <Input
                        name="newPassword"
                        type="password"
                        placeholder={'•••••••'}
                        color="warning"
                        disabled
                    />
                </FormControl>
            </Stack>
        </form>
        <form
            onSubmit={handleDJNameSubmit}
        >
            <FormControl>
                <FormLabel>
                    DJ Name
                </FormLabel>
                <Input
                    name="djName"
                    placeholder={djName}
                    value={djNameValue}
                    disabled={djNameLoading}
                    autoComplete="off"
                    endDecorator = {
                        djNameLoading ? (
                            <CircularProgress size="sm" />
                        ) : djNameValue === djName ? null : (
                            <Button 
                                type="submit"
                                color="warning"
                            >
                                Save
                            </Button>
                        )
                    }
                    onChange={(event) => {
                        setDJNameValue(event.target.value);
                    }}
                    color = {
                        djNameValue === djName ? "warning" : "danger"
                    }
                />
            </FormControl>
        </form>
        <form
            onSubmit={handleNameSubmit}
        >
            <FormControl>
                <FormLabel>
                    Name
                </FormLabel>
                <Input
                    name="name"
                    placeholder={nameValue}
                    value={nameValue}
                    disabled={nameLoading}
                    autoComplete="off"
                    endDecorator = {
                        nameLoading ? (
                            <CircularProgress size="sm" />
                        ) : nameValue === name ? null : (
                            <Button
                                type="submit"
                                color="warning"
                            >
                                Save
                            </Button>
                        )
                    }
                    onChange={(event) => {
                        setNameValue(event.target.value);
                    }}
                    color = {
                        nameValue === name ? "warning" : "danger"
                    }
                />
            </FormControl>
        </form>
        </>
    )
}

export default SettingsPage;