import { toast } from "sonner";


export const updateUserAttributes = async (userAttributes) => {

    /* let userAttributesAsArray = [];
    for (let [aName, aValue] of Object.entries(userAttributes)) {
        userAttributesAsArray.push({
            Name: aName,
            Value: aValue
        });
    }

    return cognitoISP.updateUserAttributes({
        AccessToken: localStorage.getItem('accessToken'),
        UserAttributes: userAttributesAsArray,
    }).promise().then((data) => {
        toast.success('Account updated.');
    }).catch((err) => {
        throw err;
    }); */
}