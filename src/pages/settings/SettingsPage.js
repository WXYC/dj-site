import React, {useState, useEffect} from "react";
import { Alert, Box, Button, CircularProgress, FormControl, FormHelperText, FormLabel, IconButton, Input, Option, Select, Sheet, Stack, Switch, Typography } from "@mui/joy";
import { toast } from "sonner";
import CallingCard from "../../widgets/calling-card/CallingCard";
import CopyAllIcon from '@mui/icons-material/CopyAll';
import { useAuth } from "../../services/authentication/authentication-context";

/**
 * Renders a page for user settings. Features inline save buttons for each setting.
 * @page
 * 
 * @returns {JSX.Element} The rendered component.
 */
const SettingsPage = () => {

    const { user, handleInformationUpdate } = useAuth();

    const funFactTypeValues = [
        'Favorite Artist',
        'Favorite Song',
        'Favorite Album',
        'Favorite Genre',
        'Favorite Concert',
        'Favorite Music Video',
        'Favorite Music Era',
    ];

    const [nameValue, setNameValue] = useState(user.name);
    const [nameLoading, setNameLoading] = useState(false);

    const handleNameSubmit = async (event) => {
    
            event.preventDefault();
            setNameLoading(true);

            await handleInformationUpdate({
                'name': event.target.name.value,
            }).catch((error) => {
                toast.error(error.toString());
                setNameValue(user.name);
            });

            setTimeout(() => {
                setNameLoading(false);
            }, 1000);
    }

    const [passwordLoading, setPasswordLoading] = useState(false);

    const handlePasswordSubmit = (event) => {

        event.preventDefault();
        setPasswordLoading(true);
    }

    const [djNameValue, setDJNameValue] = useState(user.djName);
    const [djNameLoading, setDJNameLoading] = useState(false);

    const handleDJNameSubmit = async (event) => {
        event.preventDefault();
        setDJNameLoading(true);
        
        await handleInformationUpdate({
            'custom:dj-name': event.target.djName.value,
        }).catch((error) => {
            toast.error(error.toString());
            setDJNameValue(user.djName);
        });

        setTimeout(() => {
            setDJNameLoading(false);
        }, 1000);
    }

    const handleShowRealNameChange = async (event) => {
        await handleInformationUpdate({
            'custom:show-real-name': event.target.checked ? 'true' : 'false',
        }).catch((error) => {
            toast.error(error.toString());
        });
    }

    const [funFactValue, setFunFactValue] = useState(user.funFact);
    const [funFactTypeValue, setFunFactTypeValue] = useState(user.funFactType);
    const [funFactLoading, setFunFactLoading] = useState(false);

    const handleFunFactSubmit = async (event) => {
        event.preventDefault();
        setFunFactLoading(true);

        await handleInformationUpdate({
            'custom:fun-fact': funFactValue,
            'custom:fun-fact-type': funFactTypeValue,
        }).catch((error) => {
            toast.error(error.toString());
            setFunFactValue(user.funFact);
            setFunFactTypeValue(user.funFactType);
        });

        setTimeout(() => {
            setFunFactLoading(false);
        }, 1000);
    }

    const [callingCardEnabled, setCallingCardEnabled] = useState(false);
    
    const handleCallingCardEnabledChange = async (event) => {
        setCallingCardEnabled(event.target.checked);
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
            <Stack
                direction="column"
                spacing={1}
            >
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
                            placeholder={user.Username}
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
                        placeholder={user.djName}
                        value={djNameValue}
                        disabled={djNameLoading}
                        autoComplete="off"
                        endDecorator = {
                            djNameLoading ? (
                                <CircularProgress size="sm" />
                            ) : djNameValue === user.djName ? null : (
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
                            djNameValue === user.djName ? "warning" : "danger"
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
                            ) : nameValue === user.name ? null : (
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
                            nameValue === user.name ? "warning" : "danger"
                        }
                    />
                </FormControl>
            </form>
            <form
                onSubmit={handleFunFactSubmit}
                
                style = {{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '0.5rem'
                }}
            >
                <FormControl
                    sx = {{
                        flex: 0.3,
                    }}
                >
                    <FormLabel>
                        Fact Type
                    </FormLabel>
                    <Select
                        name="funFactType"
                        defaultValue={funFactTypeValue}
                        disabled={funFactLoading}
                        color={funFactTypeValue === user.funFactType ? "warning" : "danger"}
                        onChange={(event, newValue) => {
                            setFunFactTypeValue(newValue);
                        }}
                    >
                        {funFactTypeValues.map((funFactTypeOption) => (
                            <Option
                                value={funFactTypeOption}
                            >
                                {funFactTypeOption}
                            </Option>
                        ))}
                    </Select>
                </FormControl>
                <FormControl
                    sx = {{
                        flex: 1,
                    }}
                >
                    <FormLabel>
                        Fun Fact
                    </FormLabel>
                    <Input
                        name="funFact"
                        placeholder={funFactValue}
                        value={funFactValue}
                        disabled={funFactLoading}
                        autoComplete="off"
                        endDecorator = {
                            funFactLoading ? (
                                <CircularProgress size="sm" />
                            ) : funFactValue === user.funFact && funFactTypeValue === user.funFactType ? null : (
                                <Button
                                    type="submit"
                                    color="warning"
                                >
                                    Save
                                </Button>
                            )
                        }
                        onChange={(event) => {
                            setFunFactValue(event.target.value);
                        }}
                        color = {
                            funFactValue === user.funFact && funFactTypeValue === user.funFactType ? "warning" : "danger"
                        }
                    />
                </FormControl>
            </form>
            </Stack>
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
                <Box
                    sx = {{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        zIndex: 2,
                        backdropFilter: callingCardEnabled ? 'blur(0)' : 'blur(1rem)',
                        borderRadius: 'lg',
                        pointerEvents: callingCardEnabled ? 'none' : 'auto',
                        transition: 'backdrop-filter 0.2s',
                    }}
                ></Box>
                <IconButton
                    size="sm"
                    disabled={!callingCardEnabled}
                    sx = {{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        zIndex: 1,
                    }}
                    onClick={() => {
                        navigator.clipboard.writeText(`http://localhost:3000/#/DJ/${djNameValue}`);
                        toast.success('Copied link to clipboard');
                    }}
                >
                    <CopyAllIcon />
                </IconButton>
                <CallingCard 
                    editor
                    variant="plain"
                    name = {nameValue}
                    djName = {djNameValue}
                    showRealName={user.showRealName}
                    funFact={funFactValue}
                    funFactType={funFactTypeValue}
                />
                <Box
                    sx = {{
                        mt: 2,
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'flex-end',
                    }}
                >
                    <Stack direction="column" gap={1}
                        sx = {{
                            justifyContent: 'flex-end',
                        }}
                    >
                    <Stack direction="row"
                        sx = {{
                            alignItems: 'center',
                            justifyContent: 'flex-end',
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
                            checked={user.showRealName}
                            onChange={handleShowRealNameChange}
                        />
                    </Stack>
                    <Stack direction="row"
                        sx = {{
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            zIndex: 3,
                        }}
                    >
                        <Typography level="body3"
                            sx = {{
                                mr: 1,
                            }}
                        >
                            Enable Calling Card
                        </Typography>
                        <Switch
                            checked={callingCardEnabled}
                            onChange={handleCallingCardEnabledChange}
                        />
                    </Stack>
                    </Stack>
                </Box>
            </Sheet>
        </Stack>
        </>
    )
}

export default SettingsPage;