"use client";

import type { CatalogSearchField, CatalogSearchRow } from "@/lib/features/catalog/types";
import { useCatalogQuerySearch } from "@/src/hooks/catalogHooks";
import { Add, Cancel, Remove, Troubleshoot } from "@mui/icons-material";
import {
  Box,
  ColorPaletteProp,
  Divider,
  IconButton,
  Option,
  Select,
  Sheet,
  Typography,
} from "@mui/joy";
import { Filters } from "./Filters";
import {
  catalogFieldSelectButtonSx,
  catalogFieldSelectSx,
  catalogInFieldClusterSx,
  catalogInLabelSx,
  catalogSearchActionSlotSx,
  catalogSearchBoxSx,
  catalogSearchFiltersGutterSx,
  catalogSearchIconLeadingSlotSx,
  catalogSearchIconSx,
  catalogSearchInputSlotSx,
  catalogSearchLeadingSlotSx,
  catalogSearchOperatorSelectButtonSx,
  catalogSearchOperatorColWidth,
  catalogSearchRowColumnsSx,
  catalogSearchRowRevealSx,
  catalogSearchRowSx,
  catalogSearchRowsAnimatedSx,
} from "./catalogSearchBoxStyles";

const FIELD_OPTIONS: { value: CatalogSearchField; label: string }[] = [
  { value: "all", label: "All" },
  { value: "artist", label: "Artists" },
  { value: "album", label: "Albums" },
  { value: "label", label: "Labels" },
];

const OPERATOR_OPTIONS = [
  { value: "AND" as const, label: "AND" },
  { value: "OR" as const, label: "OR" },
  { value: "NOT" as const, label: "NOT" },
];

function handleValueChange(
  row: CatalogSearchRow,
  next: string,
  updateRow: (id: string, updates: Partial<CatalogSearchRow>) => void,
) {
  const exact =
    next.startsWith('"') && next.endsWith('"') && next.length >= 2;
  updateRow(row.id, {
    value: exact ? next.slice(1, -1) : next,
    exact,
  });
}

function CatalogSearchInFieldCluster({
  rowId,
  testId,
}: {
  rowId: string;
  testId?: string;
}) {
  const { rows, updateRow } = useCatalogQuerySearch();
  const field =
    rows.find((r) => r.id === rowId)?.field ?? ("all" as CatalogSearchField);

  return (
    <Box
      sx={catalogInFieldClusterSx}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Typography component="span" level="body-xs" sx={catalogInLabelSx}>
        in
      </Typography>
      <Select
        data-testid={testId}
        value={field}
        variant="plain"
        color="neutral"
        onChange={(_event, newValue) => {
          if (newValue == null) return;
          updateRow(rowId, { field: newValue as CatalogSearchField });
        }}
        slotProps={{
          button: { sx: catalogFieldSelectButtonSx },
          indicator: { sx: { fontSize: "0.75rem", opacity: 0.65 } },
          listbox: {
            onClick: (e) => e.stopPropagation(),
          },
        }}
        sx={catalogFieldSelectSx}
      >
        {FIELD_OPTIONS.map((opt) => (
          <Option
            key={opt.value}
            value={opt.value}
            sx={{
              fontSize: "var(--joy-fontSize-xs)",
              letterSpacing: "0.04em",
            }}
          >
            {opt.label}
          </Option>
        ))}
      </Select>
    </Box>
  );
}

function CatalogSearchRowSegment({
  row,
  isFirst,
  multiRow,
  showAdd,
  showRemove,
  onAdd,
  onRemove,
  updateRow,
}: {
  row: CatalogSearchRow;
  isFirst: boolean;
  multiRow: boolean;
  showAdd: boolean;
  showRemove: boolean;
  onAdd: () => void;
  onRemove: () => void;
  updateRow: (id: string, updates: Partial<CatalogSearchRow>) => void;
}) {
  const hasValue = row.value !== "";
  const operatorCol = catalogSearchOperatorColWidth(multiRow);

  return (
    <Box sx={{ ...catalogSearchRowSx, ...catalogSearchRowColumnsSx(operatorCol) }}>
      <Box
        sx={
          isFirst ? catalogSearchIconLeadingSlotSx : catalogSearchLeadingSlotSx
        }
      >
        {!isFirst ? (
          <Select
            value={row.operator}
            onChange={(_, value) =>
              value && updateRow(row.id, { operator: value })
            }
            size="sm"
            variant="plain"
            color="primary"
            sx={{ width: "100%", minWidth: 0 }}
            slotProps={{
              button: { onMouseDown: (e) => e.stopPropagation() },
              listbox: { onClick: (e) => e.stopPropagation() },
            }}
          >
            {OPERATOR_OPTIONS.map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
        ) : (
          <Box sx={catalogSearchIconSx}>
            <Troubleshoot sx={{ fontSize: "1.25rem" }} />
          </Box>
        )}
      </Box>

      <Box sx={catalogSearchInputSlotSx}>
        <input
          data-testid={isFirst ? "catalog-search-input" : undefined}
          type="text"
          placeholder={isFirst ? "Search the catalog" : undefined}
          value={row.value}
          autoComplete="off"
          onChange={(e) => handleValueChange(row, e.target.value, updateRow)}
          onClick={(e) => e.stopPropagation()}
        />

        {hasValue && (
          <IconButton
            variant="plain"
            color="neutral"
            size="sm"
            aria-label="Clear search"
            sx={{ "--IconButton-size": "1.75rem", flexShrink: 0 }}
            onClick={() => updateRow(row.id, { value: "", exact: false })}
          >
            <Cancel fontSize="small" />
          </IconButton>
        )}
      </Box>

      <CatalogSearchInFieldCluster
        rowId={row.id}
        testId={isFirst ? "catalog-search-field" : undefined}
      />

      <Box sx={catalogSearchActionSlotSx}>
        {isFirst && showAdd && (
          <IconButton
            data-testid="catalog-search-add-row"
            size="sm"
            variant="plain"
            color="primary"
            aria-label="Add row"
            sx={{ "--IconButton-size": "1.75rem" }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
          >
            <Add sx={{ fontSize: "1.125rem" }} />
          </IconButton>
        )}

        {!isFirst && showRemove && (
          <IconButton
            size="sm"
            variant="plain"
            color="danger"
            aria-label="Remove row"
            sx={{ "--IconButton-size": "1.75rem" }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <Remove fontSize="small" />
          </IconButton>
        )}
      </Box>
    </Box>
  );
}

export type QueryBuilderProps = {
  color?: ColorPaletteProp;
};

export default function QueryBuilder({ color = "primary" }: QueryBuilderProps) {
  const { rows, addRow, removeRow, updateRow } = useCatalogQuerySearch();

  const multiRow = rows.length > 1;

  return (
    <Box sx={{ py: 0.5, flexShrink: 0, minWidth: 0 }}>
      <Sheet
        variant="outlined"
        data-testid="catalog-search-box"
        sx={{
          ...catalogSearchBoxSx,
        }}
        suppressHydrationWarning
      >
        <Box sx={catalogSearchRowsAnimatedSx(rows.length)}>
          {rows.map((row, index) => {
            const isFirst = index === 0;
            return (
              <Box
                key={row.id}
                sx={index > 0 ? catalogSearchRowRevealSx : undefined}
              >
                {index > 0 && <Divider sx={{ my: 0.25 }} />}
                <CatalogSearchRowSegment
                  row={row}
                  isFirst={isFirst}
                  multiRow={multiRow}
                  showAdd={isFirst}
                  showRemove={!isFirst}
                  onAdd={addRow}
                  onRemove={() => removeRow(row.id)}
                  updateRow={updateRow}
                />
              </Box>
            );
          })}
        </Box>
        <Divider sx={{ my: 0.25 }} />
        <Box sx={catalogSearchFiltersGutterSx}>
          <Filters />
        </Box>
      </Sheet>
    </Box>
  );
}
