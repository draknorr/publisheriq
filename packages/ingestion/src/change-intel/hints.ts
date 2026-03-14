export interface HintRow {
  appid: number;
  lastModified: number;
  priceChangeNumber: number;
}

export interface ExistingHintStatusRow {
  appid: number;
  steam_last_modified: number | null;
  steam_price_change_number: number | null;
}

export function partitionHintRows(
  batch: HintRow[],
  knownAppids: Set<number>,
  existingRows: Map<number, ExistingHintStatusRow>
): {
  knownRows: HintRow[];
  changedRows: HintRow[];
  skippedRows: HintRow[];
} {
  const knownRows: HintRow[] = [];
  const changedRows: HintRow[] = [];
  const skippedRows: HintRow[] = [];

  for (const row of batch) {
    if (!knownAppids.has(row.appid)) {
      skippedRows.push(row);
      continue;
    }

    knownRows.push(row);

    const existing = existingRows.get(row.appid);
    if (
      !existing ||
      existing.steam_last_modified !== row.lastModified ||
      existing.steam_price_change_number !== row.priceChangeNumber
    ) {
      changedRows.push(row);
    }
  }

  return {
    knownRows,
    changedRows,
    skippedRows,
  };
}
