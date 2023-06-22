import { Modal, ModalDialog } from "@mui/joy";
import React, {createContext, useContext, useState} from "react"

export const PopupContentContext = createContext({ openPopup: () => {} });

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