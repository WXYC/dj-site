"use client";

import { authBaseURL } from "@/lib/features/authentication/client";
import { Authorization } from "@/lib/features/admin/types";
import { authorizationToRole } from "@/lib/features/authentication/types";
import { CheckCircle, Error as ErrorIcon, Upload } from "@mui/icons-material";
import {
  Button,
  Chip,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Modal,
  ModalClose,
  ModalDialog,
  Option,
  Select,
  Stack,
  Table,
  Typography,
} from "@mui/joy";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { parseCSVImport, CSVImportRow, CSVRowError } from "./csvImport";

type ImportCSVModalProps = {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
};

type ModalState = "upload" | "preview" | "importing" | "results";

type ImportResult = {
  row: CSVImportRow;
  success: boolean;
  error?: string;
};

const CSV_TEMPLATE = "Name,Username,DJ Name,Email\n";

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("style", "display: none");
  link.setAttribute("download", "dj-import-template.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ImportCSVModal({ open, onClose, onComplete }: ImportCSVModalProps) {
  const [state, setState] = useState<ModalState>("upload");
  const [rows, setRows] = useState<CSVImportRow[]>([]);
  const [errors, setErrors] = useState<CSVRowError[]>([]);
  const [authorization, setAuthorization] = useState<Authorization>(Authorization.DJ);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validRowCount = rows.filter((_, i) => !errors.some((e) => e.row === i + 1)).length;
  const successCount = importResults.filter((r) => r.success).length;

  const handleClose = () => {
    setState("upload");
    setRows([]);
    setErrors([]);
    setAuthorization(Authorization.DJ);
    setImportProgress(0);
    setImportResults([]);
    onClose();
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const result = parseCSVImport(text);
      setRows(result.rows);
      setErrors(result.errors);
      setState("preview");
    };
    reader.readAsText(file);
  }, []);

  const handleImport = useCallback(async () => {
    setState("importing");
    setImportProgress(0);
    setImportResults([]);

    const tempPassword = String(process.env.NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD || "");
    const organizationSlug = process.env.NEXT_PUBLIC_APP_ORGANIZATION || "";
    const role = authorizationToRole(authorization);

    // Filter to only valid rows
    const validRows = rows.filter((_, i) => !errors.some((e) => e.row === i + 1));
    const results: ImportResult[] = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];

      try {
        const response = await fetch(`${authBaseURL}/admin/provision-user`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: row.email,
            username: row.username,
            password: tempPassword,
            name: row.name,
            organizationSlug,
            role,
            realName: row.name,
            djName: row.djName,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.message || errorData?.error || `Failed (${response.status})`);
        }

        results.push({ row, success: true });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to create account";
        results.push({ row, success: false, error: errorMessage });
      }

      setImportProgress(((i + 1) / validRows.length) * 100);
      setImportResults([...results]);
    }

    setState("results");

    const successCount = results.filter((r) => r.success).length;
    if (successCount === validRows.length) {
      toast.success(`Created ${successCount} account${successCount !== 1 ? "s" : ""}`);
    } else {
      toast.error(`Created ${successCount} of ${validRows.length} accounts — some failed`);
    }
  }, [rows, errors, authorization]);

  const handleDone = () => {
    onComplete();
    setState("upload");
    setRows([]);
    setErrors([]);
    setImportProgress(0);
    setImportResults([]);
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <ModalDialog
        variant="outlined"
        sx={{ maxWidth: 700, width: "100%", borderRadius: "md" }}
      >
        <ModalClose />
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <Upload />
            Import DJs from CSV
          </Stack>
        </DialogTitle>
        <DialogContent>
          {state === "upload" && (
            <Stack spacing={2}>
              <Typography level="body-sm">
                Upload a CSV file with columns: Name, Username (optional), DJ Name, Email
              </Typography>
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "2rem",
                  border: "2px dashed var(--joy-palette-neutral-outlinedBorder)",
                  borderRadius: "var(--joy-radius-md)",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <Upload sx={{ fontSize: 40, mb: 1, color: "neutral.500" }} />
                <Typography level="body-md">
                  Drop a CSV file here or click to browse
                </Typography>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                  data-testid="csv-file-input"
                />
              </label>
              <Button
                variant="plain"
                color="neutral"
                size="sm"
                onClick={downloadTemplate}
              >
                Download template
              </Button>
            </Stack>
          )}

          {state === "preview" && (
            <Stack spacing={2}>
              <Typography level="body-sm">
                Found {rows.length} account{rows.length !== 1 ? "s" : ""} to create
                {errors.length > 0 && ` (${errors.length > 0 ? rows.filter((_, i) => errors.some((e) => e.row === i + 1)).length : 0} with errors)`}
              </Typography>
              <div style={{ maxHeight: 300, overflow: "auto" }}>
                <Table size="sm" stripe="odd">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th>DJ Name</th>
                      <th>Email</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const rowErrors = errors.filter((e) => e.row === i + 1);
                      return (
                        <tr key={i}>
                          <td>{row.name || <Typography color="danger">—</Typography>}</td>
                          <td>{row.username}</td>
                          <td>{row.djName || <Typography color="danger">—</Typography>}</td>
                          <td>{row.email || <Typography color="danger">—</Typography>}</td>
                          <td>
                            {rowErrors.length > 0 ? (
                              <Chip color="danger" size="sm" variant="soft">
                                {rowErrors.map((e) => e.message).join("; ")}
                              </Chip>
                            ) : (
                              <CheckCircle color="success" fontSize="small" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography level="body-sm">Role:</Typography>
                <Select
                  size="sm"
                  color="success"
                  value={authorization}
                  onChange={(_, value) => {
                    if (value !== null) setAuthorization(value as Authorization);
                  }}
                >
                  <Option value={Authorization.NO}>Member</Option>
                  <Option value={Authorization.DJ}>DJ</Option>
                  <Option value={Authorization.MD}>Music Director</Option>
                  <Option value={Authorization.SM}>Station Manager</Option>
                </Select>
              </Stack>
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button variant="plain" color="neutral" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  variant="solid"
                  color="success"
                  disabled={validRowCount === 0}
                  onClick={handleImport}
                >
                  Create {validRowCount} Account{validRowCount !== 1 ? "s" : ""}
                </Button>
              </Stack>
            </Stack>
          )}

          {state === "importing" && (
            <Stack spacing={2}>
              <LinearProgress
                determinate
                value={importProgress}
                color="success"
                sx={{ my: 1 }}
              />
              <Typography level="body-sm" textAlign="center">
                Creating account {Math.min(importResults.length + 1, validRowCount)} of {validRowCount}...
              </Typography>
            </Stack>
          )}

          {state === "results" && (
            <Stack spacing={2}>
              <Typography level="title-md">
                Created {successCount} of {importResults.length} account{importResults.length !== 1 ? "s" : ""}
              </Typography>
              {importResults.some((r) => !r.success) && (
                <div style={{ maxHeight: 200, overflow: "auto" }}>
                  <Table size="sm">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResults
                        .filter((r) => !r.success)
                        .map((r, i) => (
                          <tr key={i}>
                            <td>{r.row.name}</td>
                            <td>{r.row.email}</td>
                            <td>
                              <Typography color="danger" level="body-sm">
                                {r.error}
                              </Typography>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </Table>
                </div>
              )}
              <Stack direction="row" justifyContent="flex-end">
                <Button variant="solid" color="success" onClick={handleDone}>
                  Done
                </Button>
              </Stack>
            </Stack>
          )}
        </DialogContent>
      </ModalDialog>
    </Modal>
  );
}
