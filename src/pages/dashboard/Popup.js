import { Modal, ModalDialog } from "@mui/joy";
import React, {createContext, useState} from "react"

export const PopupContentContext = createContext({ openPopup: () => {} });

export const PopupProvider = ({children}) => {
    const [popupContent, setPopupContent] = useState(null);
    const [o, setOpen] = useState(false);

    const openPopup = (content) => {
        setPopupContent(content);
        setOpen(true);
    }

    const closePopup = () => {
        setOpen(false);
    }
    
    return (
        <PopupContentContext.Provider value={{ openPopup, closePopup }}>
            <Modal
                open={o}
                onClose={() => setOpen(false)}
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
        {children}
        </PopupContentContext.Provider>
    )
}