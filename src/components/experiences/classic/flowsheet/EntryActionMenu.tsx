"use client";

import { useEffect, useRef, useState } from "react";
import "@/src/styles/classic/actions.css";

type Props = {
  entryId: number;
  onEdit: (entryId: number) => void;
  onDelete: (entryId: number) => void;
};

export default function EntryActionMenu({ entryId, onEdit, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    onEdit(entryId);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    onDelete(entryId);
  };

  return (
    <div className={`action-menu${open ? " open" : ""}`} ref={menuRef}>
      <button
        type="button"
        className="action-trigger"
        aria-label="Actions"
        onClick={() => setOpen((v) => !v)}
      >
        {"⋯"}
      </button>
      <div className="action-dropdown" role="menu">
        <a href="#" className="action-item" onClick={handleEdit} role="menuitem">
          Edit
        </a>
        <a
          href="#"
          className="action-item action-delete"
          onClick={handleDelete}
          role="menuitem"
        >
          Delete
        </a>
      </div>
    </div>
  );
}
