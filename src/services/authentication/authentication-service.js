import AWS, { CognitoIdentityServiceProvider } from 'aws-sdk';
import { toast } from 'sonner';
import jwtDecode from 'jwt-decode';

AWS.config.update({
    region: process.env.REACT_APP_AWS_REGION
});

let persistedISP = null;

const nullResult = { userObject: null, resetPasswordRequired: false, isAuthenticated: false, isAdmin: false };

export const refreshCognitoCredentials = async (notify = false) => {
    let idToken = sessionStorage.getItem('idToken');
    let cognitoISP = null;
    const credentialManager = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: process.env.REACT_APP_AWS_IDENTITY_POOL_ID,
        Logins: {
            [`cognito-idp.${process.env.REACT_APP_AWS_REGION}.amazonaws.com/${process.env.REACT_APP_AWS_USER_POOL_ID}`]: idToken
        }
    });

    return await new Promise((resolve, reject) => {
        credentialManager.refresh((error) => {
            if (error) reject(error);

            if (notify) toast.success("Admin Privilages Granted.");

            cognitoISP = new AWS.CognitoIdentityServiceProvider({ 
                apiVersion: '2016-04-18', 
                region: process.env.REACT_APP_AWS_REGION,
                credentials: credentialManager
            });

            resolve(cognitoISP);
        });
    });
}

export const login = async (event) => {
    const username = event.target.username.value;
    const password = event.target.password.value;

    const params = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: process.env.REACT_APP_AWS_CLIENT_ID,
        AuthParameters: {
            USERNAME: username,
            PASSWORD: password
        }
    };

    AWS.config.update({
        region: process.env.REACT_APP_AWS_REGION
    });

    const creatorISP = new AWS.CognitoIdentityServiceProvider({
        apiVersion: '2016-04-18',
        region: process.env.REACT_APP_AWS_REGION
    });

    return new Promise((resolve, reject) => {
        creatorISP.initiateAuth(params, function (err, data) {
            if (err) return handleError(err, resolve);

            if (data.ChallengeName == 'NEW_PASSWORD_REQUIRED') {
                
                persistedISP = creatorISP;

                return resolve({
                    userObject: {
                        Username: username,
                        Session: data.Session
                    },
                    resetPasswordRequired: true,
                    isAuthenticated: false,
                    isAdmin: false
                });
            } else {
                sessionStorage.setItem('accessToken', data.AuthenticationResult.AccessToken);
                sessionStorage.setItem('idToken', data.AuthenticationResult.IdToken);
                localStorage.setItem('refreshToken', data.AuthenticationResult.RefreshToken);

                const userParams = {
                    AccessToken: data.AuthenticationResult.AccessToken
                };

                let adminTest = jwtDecode(data.AuthenticationResult.IdToken)['cognito:groups']?.includes('station-management');

                creatorISP.getUser(userParams, function (err, userData) {
                    if (err) return handleError(err, resolve);

                    toast.success('Logged in!');
                    resolve({
                        userObject: userData,
                        resetPasswordRequired: false,
                        isAuthenticated: true,
                        isAdmin: adminTest
                    });
                });
            }
        });
    });
};

export const logout = async () => {
    sessionStorage.clear();
    localStorage.clear();
    return nullResult;
};

export const globalLogout = async (auth) => {
    const cognitoISP = refreshCognitoCredentials();
    return cognitoISP.globalSignOut({
        AccessToken: auth.AuthenticationResult.AccessToken
    }, function (err, data) {
        if (err) return handleError(err);

        return logout();       
    });
};

export const checkAuth = async () => {
    const accessToken = sessionStorage.getItem('accessToken');
    const idToken = sessionStorage.getItem('idToken');
    const refreshToken = localStorage.getItem('refreshToken');

    if (!accessToken || !idToken || !refreshToken) {
        return nullResult;
    }

    const params = {
        AccessToken: accessToken
    };

    const creatorISP = new AWS.CognitoIdentityServiceProvider({
        apiVersion: '2016-04-18',
        region: process.env.REACT_APP_AWS_REGION
    });

    return new Promise((resolve, reject) => {
        creatorISP.getUser(params, async (err, userData) => {
            if (err == 'Access Token has expired' || err?.message == 'Access Token has expired') {
                return resolve(await refreshYourToken(creatorISP));
            }

            if (err) handleError(err, resolve);

            let adminTest = jwtDecode(idToken)['cognito:groups']?.includes('station-management');

            resolve({
                userObject: userData,
                resetPasswordRequired: false,
                isAuthenticated: true,
                isAdmin: adminTest
            });
        });
    });
};

export const refreshYourToken = async (cognitoISP) => {

    if (!localStorage.getItem('refreshToken')) {
        return nullResult;
    }

    return new Promise((resolve, reject) => {
        cognitoISP.initiateAuth({
            AuthFlow: 'REFRESH_TOKEN_AUTH',
            ClientId: process.env.REACT_APP_AWS_CLIENT_ID,
            AuthParameters: {
                REFRESH_TOKEN: localStorage.getItem('refreshToken')
            }
        }, function (err, data) {
            if (err) return handleError(null, resolve);

            sessionStorage.setItem('accessToken', data.AuthenticationResult.AccessToken);
            sessionStorage.setItem('idToken', data.AuthenticationResult.IdToken);
            localStorage.setItem('refreshToken', data.AuthenticationResult.RefreshToken);

            cognitoISP.getUser({
                AccessToken: data.AuthenticationResult.AccessToken
            }, function (err, userData) {
                if (err) return handleError(err, resolve);

                let adminTest = jwtDecode(data.AuthenticationResult.IdToken)['cognito:groups']?.includes('station-management');

                resolve({
                    userObject: userData,
                    resetPasswordRequired: false,
                    isAuthenticated: true,
                    isAdmin: adminTest
                });
            });
        });
    });
};

export const updateUserInformation = async (attributes) => {

    let cognitoISP = await refreshCognitoCredentials();

    let formattedAttributes = Array.from(Object.keys(attributes), key => ({
        Name: key,
        Value: attributes[key]
    }));

    return new Promise((resolve, reject) => {
        cognitoISP.updateUserAttributes({
            AccessToken: sessionStorage.getItem('accessToken'),
            UserAttributes: formattedAttributes
        }, function (err, data) {
            if (err) reject(err);

            cognitoISP.getUser({
                AccessToken: sessionStorage.getItem('accessToken')
            }, function (err, userData) {
                if (err) reject(err);

                resolve({
                    userObject: userData,
                    resetPasswordRequired: false,
                    isAuthenticated: true,
                    isAdmin: jwtDecode(sessionStorage.getItem('idToken'))['cognito:groups']?.includes('station-management')
                });
            });
        });
    });
};

export const updatePasswordFlow = async (event, user) => {
    event.preventDefault();

    let cognitoISP = persistedISP;
    
    return new Promise((resolve, reject) => {
        cognitoISP.respondToAuthChallenge({
            ChallengeName: 'NEW_PASSWORD_REQUIRED',
            ClientId: process.env.REACT_APP_AWS_CLIENT_ID,
            ChallengeResponses: {
                USERNAME: user.Username,
                NEW_PASSWORD: event.target.password.value,
                'userAttributes.name': event.target.name.value,
            },
            Session: user.Session
        }).promise().then((data) => {
            cognitoISP.updateUserAttributes({
                AccessToken: data.AuthenticationResult.AccessToken,
                UserAttributes: [
                    {
                        Name: 'custom:dj-name',
                        Value: event.target.djName.value
                    },
                ]
            }).promise().then(async (data) => {
                cognitoISP.initiateAuth({
                    AuthFlow: 'USER_PASSWORD_AUTH',
                    ClientId: process.env.REACT_APP_AWS_CLIENT_ID,
                    AuthParameters: {
                        USERNAME: user.Username,
                        PASSWORD: event.target.password.value
                    }
                }).promise().then((data) => {
                    sessionStorage.setItem('accessToken', data.AuthenticationResult.AccessToken);
                    sessionStorage.setItem('idToken', data.AuthenticationResult.IdToken);
                    localStorage.setItem('refreshToken', data.AuthenticationResult.RefreshToken);

                    cognitoISP.getUser({
                        AccessToken: data.AuthenticationResult.AccessToken
                    }, function (err, userData) {
                        if (err) return handleError(err, resolve);

                        toast.success('Logged in!');
                        resolve({
                            userObject: userData,
                            resetPasswordRequired: false,
                            isAuthenticated: true,
                            isAdmin: false
                        });
                    });
                }).catch((err) => {
                    handleError(err, resolve);
                });
            }).catch((err) => {
                handleError(err, resolve);
            });
        }).catch((err) => {
            handleError(err, resolve);
        });
    });
}

export const handleError = (err, resolve) => {
    if (err) toast.error(err.message || JSON.stringify(err));
    resolve(nullResult);
}
