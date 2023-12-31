import React, { useContext, useEffect, useState, createContext } from 'react';
import IconButton from '@mui/joy/IconButton';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import AutoFixOffIcon from '@mui/icons-material/AutoFixOff';
import { Tooltip } from '@mui/joy';

export const ViewContext = createContext();

const ViewProvider = ({ children }) => {
    const [classicView, setClassicView] = useState(localStorage.getItem('classicView') === 'true' || false);

    useEffect(() => {
        localStorage.setItem('classicView', classicView);
    }, [classicView]);

    return (
        <ViewContext.Provider value={{classicView, setClassicView}}>
            {children}
        </ViewContext.Provider>
    );
};

export default ViewProvider;

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
export function ViewStyleToggle({ onClick, ...props }) {
    const {classicView, setClassicView} = useContext(ViewContext);

    const [mounted, setMounted] = useState(false);
    useEffect(() => {
      setMounted(true);
    }, []);
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
          setClassicView(!classicView);
          document.documentElement.dataset.classicView = !classicView;
          onClick?.(event);
        }}
      >
        {classicView ? <AutoFixHighIcon /> : <AutoFixOffIcon />}
      </IconButton>
      </Tooltip>
    );
  }