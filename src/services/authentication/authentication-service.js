import AWS, { CognitoIdentityServiceProvider } from 'aws-sdk';
import { toast } from 'sonner';
import jwtDecode from 'jwt-decode';


export const AWS_REGION = 'us-east-2';
export const AWS_USER_POOL_ID = 'us-east-2_ilnKaF5KQ';
export const AWS_CLIENT_ID = '5k75jn39vgdfavhun058t8m2te';
export const AWS_IDENTITY_POOL_ID = 'us-east-2:1438d416-cb03-4589-986d-e6e71f7d7b39'
export const AWS_ROLE_ARN = 'arn:aws:iam::203767826763:role/station-management';

AWS.config.update({
    region: AWS_REGION
});

let persistedISP = null;

const nullResult = { userObject: null, resetPasswordRequired: false, isAuthenticated: false, isAdmin: false };

export const refreshCognitoCredentials = async (notify = false) => {
    let idToken = sessionStorage.getItem('idToken');
    let cognitoISP = null;
    const credentialManager = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: AWS_IDENTITY_POOL_ID,
        Logins: {
            [`cognito-idp.${AWS_REGION}.amazonaws.com/${AWS_USER_POOL_ID}`]: idToken
        }
    });

    return await new Promise((resolve, reject) => {
        credentialManager.refresh((error) => {
            if (error) reject(error);

            if (notify) toast.success("Admin Privilages Granted.");

            cognitoISP = new AWS.CognitoIdentityServiceProvider({ 
                apiVersion: '2016-04-18', 
                region: AWS_REGION,
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
        ClientId: AWS_CLIENT_ID,
        AuthParameters: {
            USERNAME: username,
            PASSWORD: password
        }
    };

    AWS.config.update({
        region: AWS_REGION
    });

    const creatorISP = new AWS.CognitoIdentityServiceProvider({
        apiVersion: '2016-04-18',
        region: AWS_REGION
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
                sessionStorage.setItem('refreshToken', data.AuthenticationResult.RefreshToken);

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
    const refreshToken = sessionStorage.getItem('refreshToken');

    if (!accessToken || !idToken || !refreshToken) {
        return nullResult;
    }

    const params = {
        AccessToken: accessToken
    };

    const creatorISP = new AWS.CognitoIdentityServiceProvider({
        apiVersion: '2016-04-18',
        region: AWS_REGION
    });

    return new Promise((resolve, reject) => {
        creatorISP.getUser(params, function (err, userData) {
            if (err == 'Access Token has expired') {
                return refreshYourToken(checkAuth);
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

export const refreshYourToken = async (callback) => {
    

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
            ClientId: AWS_CLIENT_ID,
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
                    ClientId: AWS_CLIENT_ID,
                    AuthParameters: {
                        USERNAME: user.Username,
                        PASSWORD: event.target.password.value
                    }
                }).promise().then((data) => {
                    sessionStorage.setItem('accessToken', data.AuthenticationResult.AccessToken);
                    sessionStorage.setItem('idToken', data.AuthenticationResult.IdToken);
                    sessionStorage.setItem('refreshToken', data.AuthenticationResult.RefreshToken);

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
    toast.error(err.message || JSON.stringify(err));
    resolve(nullResult);
}
