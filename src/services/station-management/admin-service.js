import { toast } from 'sonner';
import { refreshCognitoCredentials } from '../authentication/authentication-service';


export const createUser = async (username, email, tempPassword) => {

    const cognitoISP = await refreshCognitoCredentials();
    
    cognitoISP.adminCreateUser({
        UserPoolId: process.env.REACT_APP_AWS_USER_POOL_ID,
        Username: username,
        TemporaryPassword: tempPassword,
        DesiredDeliveryMediums: ["EMAIL"],
        UserAttributes: [
            {
                Name: "email",
                Value: email,
            }
        ]
    }).promise().then((_) => {
        toast.success(`Successfully created an account for ${username}`);
    }).catch((err) => {
        toast.error(err.message || JSON.stringify(err));
    });
}

export const deleteUser = async (username) => {

    const cognitoISP = await refreshCognitoCredentials();

    cognitoISP.adminDeleteUser({
        UserPoolId: process.env.REACT_APP_AWS_USER_POOL_ID,
        Username: username,
    }).promise().then((_) => {
        toast.success(`Successfully deleted ${username}`);
    }).catch((err) => {
        toast.error(err.message || JSON.stringify(err));
    });
}

export const resetPassword = async (username, email, tempPassword) => {
    
    const cognitoISP = await refreshCognitoCredentials();

    cognitoISP.adminSetUserPassword({
        Password: tempPassword,
        Permanent: false,
        UserPoolId: process.env.REACT_APP_AWS_USER_POOL_ID,
        Username: username,
    }).promise().then((_) => {
        toast.success(`Successfully reset ${username}'s password`);
    }).catch((err) => {
        toast.error(err.message || JSON.stringify(err));
    });
}

export const listUsers = async (formatted = true) => {

    const cognitoISP = await refreshCognitoCredentials();

    return await new Promise(async (resolve, reject) => {
        cognitoISP.listUsers({
            UserPoolId: process.env.REACT_APP_AWS_USER_POOL_ID,
        }).promise().then((data) => {
            if (formatted) {
                Promise.all(Array.from(
                    data.Users.map(async (user) => userObjectToUser(user))
                )).then((users) => {
                    resolve(users);
                });
            } else {
                resolve(data.Users);
            }
        }).catch((err) => {
            toast.error(err.message || JSON.stringify(err));
        });
    });
}

export const listUsersInGroup = async (group, formatted = true) => {

    const cognitoISP = await refreshCognitoCredentials();

    return new Promise((resolve, reject) => {
        cognitoISP.listUsersInGroup({
            UserPoolId: process.env.REACT_APP_AWS_USER_POOL_ID,
            GroupName: group,
        }).promise().then((data) => {
            if (formatted) {
                resolve(Array.from(
                    data.Users.map(async (user) => userObjectToUser(user))
                ));
            } else {
                resolve(data.Users);
            }
        }).catch((err) => {
            toast.error(err.message || JSON.stringify(err));
        });
    });
}

export const isAdmin = async (username) => {
    return new Promise((resolve, reject) => {
        listUsersInGroup('station-management', false).then((userArray) => {
            resolve(userArray.find((user) => user.Username === username) !== undefined);
        })
    });
}

export const makeAdmin = async (username) => {
    const cognitoISP = await refreshCognitoCredentials();

    cognitoISP.adminAddUserToGroup({
        UserPoolId: process.env.REACT_APP_AWS_USER_POOL_ID,
        Username: username,
        GroupName: 'station-management',
    }).promise().then((data) => {
        toast.success(`Successfully gave ${username} a station management account.`);
    }).catch((err) => {
        toast.error(err.message || JSON.stringify(err));
    });
}

export const removeAdmin = async (username) => {
    const cognitoISP = await refreshCognitoCredentials();

    cognitoISP.adminRemoveUserFromGroup({
        UserPoolId: process.env.REACT_APP_AWS_USER_POOL_ID,
        Username: username,
        GroupName: 'station-management',
    }).promise().then((data) => {
        toast.success(`Successfully removed ${username}'s station management account.`);
    }).catch((err) => {
        toast.error(err.message || JSON.stringify(err));
    });
}

export const userObjectToUser = async (userObject, username) => {

    let adminTest = await isAdmin(userObject.Username);
    let selfTest = userObject.Username === username;

    return {
        username: userObject.Username,
        name: userObject.Attributes?.find((attribute) => attribute.Name === 'name')?.Value ?? '',
        shows: null,
        djName: userObject.Attributes?.find((attribute) => attribute.Name === 'custom:dj-name')?.Value ?? '',
        isAdmin: adminTest,
        isSelf: selfTest,
    }
}