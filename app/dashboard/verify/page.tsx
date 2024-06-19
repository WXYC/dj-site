'use client';

import { fetchDJs, getAuthenticatedUser, useDispatch, useSelector } from "@/lib/redux";
import { getter } from "@/lib/services";
import { useEffect } from "react";
import { toast } from "sonner";

export default function VerifyPage() {

  const user = useSelector(getAuthenticatedUser);
  const dispatch = useDispatch();

  useEffect(() => {
    console.log("mounted");

    const process = async (e: KeyboardEvent) => {
      if ((e as KeyboardEvent).key === 'v') {
        let token = sessionStorage.getItem("idToken");
        if (!token) {
          toast.error("No TOKEN!!!");
          return;
        }
        await dispatch(fetchDJs(token));
      }
    }

    window.addEventListener('keydown', process);

    return () => {
      console.log('Verify page unmounted');
      window.removeEventListener('keydown', process);
    }
  }, [user?.djId]);

  return (
    <>
      <h1>Verify page</h1>
      <p>
        This page is intended to verify that Redux state is persisted across
        page navigations.
      </p>
      <table>
      <thead>
        <tr>
          <th>Property</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Username</td>
          <td>{user?.username}</td>
        </tr>
        <tr>
          <td>DJ Name</td>
          <td>{user?.djName}</td>
        </tr>
        <tr>
          <td>DJ ID</td>
          <td>{user?.djId}</td>
        </tr>
        <tr>
          <td>Name</td>
          <td>{user?.name}</td>
        </tr>
        <tr>
          <td>Is Admin</td>
          <td>{user?.isAdmin ? 'Yes' : 'No'}</td>
        </tr>
        <tr>
          <td>Show Real Name</td>
          <td>{user?.showRealName ? 'Yes' : 'No'}</td>
        </tr>
      </tbody>
    </table>
    </>
  );
}