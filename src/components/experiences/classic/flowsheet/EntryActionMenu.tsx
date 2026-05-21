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
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleEdit = () => {
    setOpen(false);
    onEdit(entryId);
  };

  const handleDelete = () => {
    setOpen(false);
    onDelete(entryId);
  };

  return (
    <div className={`action-menu${open ? " open" : ""}`} ref={menuRef}>
      <button
        type="button"
        className="action-trigger"
        aria-label="Actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {"⋯"}
      </button>
      {open && (
        <div className="action-dropdown" role="menu">
          <button
            type="button"
            className="action-item"
            onClick={handleEdit}
            role="menuitem"
          >
            Edit
          </button>
          <button
            type="button"
            className="action-item action-delete"
            onClick={handleDelete}
            role="menuitem"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
