"use client";

/* Core */
import { usePathname } from "next/navigation";

import {
  LoginCredentials,
  authenticationSlice,
  isLoggedIn,
  login,
  useDispatch,
  useSelector,
} from "@/lib/redux";

/* Instruments */
import React, { useState } from "react";
import styles from "../styles/layout.module.css";

export const Nav = () => {
  const dispatch = useDispatch();
  const pathname = usePathname();
  const loggedIn = useSelector(isLoggedIn);

  const [credentials, setCredentials] = useState<LoginCredentials>({
    username: "",
    password: "",
  });

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials((prevCredentials) => ({
      ...prevCredentials,
      username: e.target.value,
    }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials((prevCredentials) => ({
      ...prevCredentials,
      password: e.target.value,
    }));
  };

  return (
    <div>
      <nav className={styles.nav}>
        {loggedIn ? (
          <div>
            <button
              onClick={() => dispatch(authenticationSlice.actions.logout())}
            >
              Logout
            </button>
            <div>LOGGED IN</div>
          </div>
        ) : (
          <div>
            <form>
              <input
                type="text"
                placeholder="Username"
                value={credentials.username}
                onChange={handleUsernameChange}
              />
              <input
                type="password"
                placeholder="Password"
                value={credentials.password}
                onChange={handlePasswordChange}
              />
            </form>
            <button onClick={() => dispatch(login(credentials))}>Login</button>
            <div>LOGGED OUT</div>
          </div>
        )}
      </nav>
    </div>
  );
};
