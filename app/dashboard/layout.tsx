'use client';
import { getClassicViewAvailable, useSelector } from '@/lib/redux';
import AuthenticationGuard from "../components/Authentication/AuthenticationGuard";
import ViewGuard from '../components/General/ViewGuard';
import DashboardContent from './dashboard';

/**
 * @page
 * @category DashboardLayout
 *
 * @description
 * The Dashboard component is the wrapper for all authenticated pages in the application. It provides the layout and sidebars for the dashboard view. This component is responsible for rendering the header, sidebars, main content area, and toggles for color scheme and view style.
 *
 * @param {ReactNode} props.children - The child components to be rendered within the main content area.
 *
 * @returns {JSX.Element} The rendered Dashboard component.
 */
export default function Dashboard(props: React.PropsWithChildren): JSX.Element {

    return (
    <>
        <ViewGuard />
        <AuthenticationGuard redirectTo='/login' savePath />
        <DashboardContent>
            {props.children}
        </DashboardContent>
    </>
    );
}