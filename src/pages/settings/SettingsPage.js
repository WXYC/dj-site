import React, {useState} from "react";
import { Alert, Box, Button, CircularProgress, FormControl, FormHelperText, FormLabel, IconButton, Input, Sheet, Stack, Switch, Typography } from "@mui/joy";
import { updateUserAttributes } from "../../services/settings/settingsFunctions";
import { toast } from "sonner";
import CallingCard from "../../widgets/calling-card/CallingCard";
import CopyAllIcon from '@mui/icons-material/CopyAll';

const SettingsPage = ({
    forceUpdate,
    djName,
    username,
    name,
    showRealName,
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

    const handleShowRealNameChange = async (event) => {
        await updateUserAttributes({
            'custom:show-real-name': event.target.checked ? '1' : '0',
        }).then(() => {
            forceUpdate();
        }).catch((error) => {
            toast.error(error.toString());
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
        <Stack
            direction={{ xs: 'column', lg: 'row' }}
        >
            <Box>
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
            </Box>
            <Sheet
                variant="outlined"
                sx = {{
                    flex: 1,
                    borderRadius: 'lg',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 2,
                    ml: { xs: 0, lg: 2 },
                    mt: { xs: 2, lg: 0 },
                }}
            >
                <IconButton
                    size="sm"
                    sx = {{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        zIndex: 1,
                    }}
                >
                    <CopyAllIcon />
                </IconButton>
                <CallingCard 
                    variant="solid"
                    name = {nameValue}
                    djName = {djNameValue}
                    showRealName={showRealName}
                />
                <Box
                    sx = {{
                        mt: 2,
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'flex-end',
                    }}
                >
                    <Stack direction="row"
                        sx = {{
                            alignItems: 'center',
                        }}
                    >
                        <Typography level="body3"
                            sx = {{
                                mr: 1,
                            }}
                        >
                            Show Real Name on Calling Card
                        </Typography>
                        <Switch
                            checked={showRealName}
                            onChange={handleShowRealNameChange}
                        />
                    </Stack>
                </Box>
            </Sheet>
        </Stack>
        </>
    )
}

export default SettingsPage;