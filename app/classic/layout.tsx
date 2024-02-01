import { getClassicView, useSelector } from "@/lib/redux";
import AuthenticationGuard from "../components/Authentication/AuthenticationGuard"
import ViewGuard from "../components/General/ViewGuard";


export const Classic = (props: React.PropsWithChildren) => {
    const classicView = useSelector(getClassicView);

    return (
        <div>
            <ViewGuard />
            <AuthenticationGuard redirectTo='/login' savePath />
            {props.children}
        </div>
    )
}