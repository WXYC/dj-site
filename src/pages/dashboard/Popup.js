import { Modal, ModalDialog } from "@mui/joy";
import React, {createContext, useContext, useState} from "react"

export const PopupContentContext = createContext({ openPopup: () => {} });

/**
 * @component
 *
 * @description
 * The `PopupProvider` component creates a global context to manage the opening and closing of a popup modal. It provides a context provider that can be used to open a popup with the specified content. The `PopupProvider` should wrap the components that need to access the popup functionality.
 *
 * @param {Object} props - The component props.
 * @param {ReactNode} props.children - The child components to be wrapped by the `PopupProvider`.
 *
 * @returns {JSX.Element} The rendered `PopupProvider` component.
 */
export const PopupProvider = ({children}) => {
    const [popupContent, setPopupContent] = useState(null);
    const [open, setOpen] = useState(false);

    const openPopup = (content) => {
        setPopupContent(content);
        setOpen(true);
    }

    const closePopup = () => {
        setOpen(false);
    }
    
    return (
        <PopupContentContext.Provider value={{ open, openPopup, closePopup, popupContent }}>
        {children}
        </PopupContentContext.Provider>
    )
}

/**
 * @component
 *
 * @description
 * The `GlobalPopups` component is responsible for rendering the global popup modal. It consumes the `PopupContentContext` to access the state of the popup and its content. The popup modal is displayed when the `open` state is `true` and the `popupContent` is rendered within the modal.
 *
 * @returns {JSX.Element} The rendered `GlobalPopups` component.
 */
export const GlobalPopups = () => {
    const { open, popupContent, closePopup } = useContext(PopupContentContext);

    return (
        <Modal
        open={open}
        onClose={closePopup}
    >
        <ModalDialog
            sx = {{
                transform: {
                    xs: "translate(-50%, -50%)",
                    sm: "translate(-50%, -50%)",
                    md: "translate(calc(-50% - 125px), -50%)",
                }
            }}
        >
            {popupContent}
        </ModalDialog>
    </Modal>
    )
}