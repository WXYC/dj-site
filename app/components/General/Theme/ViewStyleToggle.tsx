'use client';
import { applicationSlice, getClassicView, useDispatch, useSelector } from '@/lib/redux';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import AutoFixOffIcon from '@mui/icons-material/AutoFixOff';
import { Tooltip, useColorScheme } from '@mui/joy';
import IconButton from '@mui/joy/IconButton';
import { redirect, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface ViewStyleToggleProps {
    onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

/**
 * Component for toggling between classic and new view styles.
 *
 * @component
 * @category Theme
 *
 * @example
 * // Usage example:
 * import { ViewStyleToggle } from '@mui/joy';
 *
 * const ExampleComponent = () => {
 *   const handleToggleViewStyle = () => {
 *     // Handle view style toggle logic here
 *   };
 *
 *   return (
 *     <ViewStyleToggle onClick={handleToggleViewStyle} />
 *   );
 * };
 *
 * @param {Object} props - The component props.
 * @param {Function} [props.onClick] - The callback function to be called when the toggle button is clicked.
 *
 * @returns {JSX.Element} The rendered ViewStyleToggle component.
 *
 */
export function ViewStyleToggle(props: ViewStyleToggleProps): JSX.Element {
    
    const dispatch = useDispatch();
    const classicView = useSelector(getClassicView);

    const { mode, setMode } = useColorScheme();

    const pathname = usePathname();

    const [mounted, setMounted] = useState(false);
    useEffect(() => {
      setMounted(true);

      dispatch(applicationSlice.actions.setClassicView(sessionStorage.getItem("classicView") === "true"));
      
      return () => {
        setMounted(false);
      };
    }, []);

    useEffect(() => {
      document.querySelector('html')?.setAttribute('data-classic-view', classicView ? 'true' : 'false');
    }, [classicView]);

    if (!mounted) {
      return <IconButton size="sm" variant="plain" color="neutral" disabled />;
    }
    return (
      <Tooltip 
        title={`Switch to ${(classicView) ? 'new' : 'classic'} view`}
        size="sm"
        placement="bottom"
        variant="outlined"
      >
      <IconButton
        id="toggle-mode"
        size="sm"
        variant="plain"
        color="neutral"
        {...props}
        onClick={(event) => {
          dispatch(applicationSlice.actions.toggleClassicView());
          props.onClick?.(event);
          sessionStorage.setItem("classicView", classicView ? "true" : "false");
          sessionStorage.setItem("modeSavedFromClassic", mode === 'light' ? "light": "dark");
          setMode('light');
          redirect(`../${classicView ? "dashboard" : "classic"}/${pathname}`);
        }}
      >
        {classicView ? <AutoFixHighIcon /> : <AutoFixOffIcon />}
      </IconButton>
      </Tooltip>
    );
  }