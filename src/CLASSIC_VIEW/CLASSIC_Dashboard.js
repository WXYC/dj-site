import React, { useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ViewStyleToggle, ViewContext } from "../components/general/theme/viewStyleToggle";

const CLASSIC_Dashboard = (props) => {

    const navigate = useNavigate();

    const { classicView } = useContext(ViewContext);

    useEffect(() => {
        
        document.documentElement.dataset.classicView = classicView;
        
    }, [classicView]);

    return (
        <React.Fragment>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0 1rem",
                    height: "4rem",
                    marginBottom: "1rem",
                    background: "whitesmoke",
                }}
            >
                <div>
                    Navigation:&nbsp;
                    <input
                        type="button"
                        value="Card Catalog"
                        onClick={() => navigate("/catalog")}
                    />&nbsp;
                    <input
                        type="button"
                        value="Flow Sheet"
                        onClick={() => navigate("/flowsheet")}
                    />
                </div>
                <ViewStyleToggle />
            </div>
            {props.children}
        </React.Fragment>
    )
}

export default CLASSIC_Dashboard;
