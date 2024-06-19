import { authenticationSlice, useDispatch } from "@/lib/redux"


export default function LogoutClassic() {

    const dispatch = useDispatch();
    const logout = () => dispatch(authenticationSlice.actions.logout());

    return (
        <a onClick={logout} href="#" >
            Log out
        </a>
    )
}