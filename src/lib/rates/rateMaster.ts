import type {
  RateTypeBulkCreateInput,
  RateTypeRecord,
} from "@/platform/types";

export const RATE_CODE_PATTERN = /^[A-Z0-9_-]{1,30}$/;

export type BulkRateDraft = {
  name: string;
  code: string;
  sortOrder: string | number;
  isActive: boolean;
  isDefault: boolean;
};

export type BulkRateField = "name" | "code" | "sortOrder" | "isActive" | "isDefault";

export type BulkRateValidationError = {
  row: number;
  field: BulkRateField;
  message: string;
};

export type ParsedRateLine = BulkRateDraft & {
  line: number;
  codeManuallyEdited: boolean;
};

export function normalizeCaseInsensitive(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function generateRateCode(name: string) {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
}

export function codeAfterNameChange(
  name: string,
  currentCode: string,
  codeManuallyEdited: boolean,
) {
  return codeManuallyEdited ? currentCode : generateRateCode(name);
}

export function nextRateSortOrder(
  rows: Array<Pick<RateTypeRecord, "sortOrder"> | Pick<BulkRateDraft, "sortOrder">>,
) {
  const maximum = rows.reduce((max, row) => {
    const value = Number(row.sortOrder);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  return Math.floor(maximum / 10) * 10 + 10;
}

export function isCompletelyBlankBulkRate(row: BulkRateDraft) {
  return (
    !row.name.trim() &&
    !row.code.trim() &&
    row.isActive &&
    !row.isDefault
  );
}

export function trimBlankTrailingRateRows<T extends BulkRateDraft>(rows: T[]) {
  let end = rows.length;
  while (end > 0 && isCompletelyBlankBulkRate(rows[end - 1])) end -= 1;
  return rows.slice(0, end);
}

function addError(
  errors: BulkRateValidationError[],
  row: number,
  field: BulkRateField,
  message: string,
) {
  errors.push({ row, field, message });
}

export function validateBulkRateRows(
  draftRows: BulkRateDraft[],
  existingRows: Array<Pick<RateTypeRecord, "name" | "code" | "deletedAt">> = [],
  options: { ignoreBlankTrailingRows?: boolean } = {},
) {
  const rows = options.ignoreBlankTrailingRows === false
    ? draftRows
    : trimBlankTrailingRateRows(draftRows);
  const errors: BulkRateValidationError[] = [];
  const normalized: RateTypeBulkCreateInput[] = [];
  const nameOwners = new Map<string, number>();
  const codeOwners = new Map<string, number>();
  const existingNames = new Set(
    existingRows
      .filter((row) => !row.deletedAt)
      .map((row) => normalizeCaseInsensitive(row.name)),
  );
  const existingCodes = new Set(
    existingRows
      .filter((row) => !row.deletedAt)
      .map((row) => normalizeCaseInsensitive(row.code)),
  );
  let defaultCount = 0;

  rows.forEach((row, index) => {
    const name = row.name.trim();
    const code = row.code.trim().toUpperCase();
    const rawSortOrder = row.sortOrder;
    const sortOrder =
      typeof rawSortOrder === "number" || typeof rawSortOrder === "string"
        ? Number(rawSortOrder)
        : Number.NaN;
    const nameKey = normalizeCaseInsensitive(name);
    const codeKey = normalizeCaseInsensitive(code);

    if (!name) addError(errors, index, "name", "Rate name is required.");
    if (!code) {
      addError(errors, index, "code", "Rate code is required.");
    } else if (!RATE_CODE_PATTERN.test(code)) {
      addError(
        errors,
        index,
        "code",
        "Use 1-30 uppercase letters, numbers, hyphens or underscores.",
      );
    }
    if (
      String(rawSortOrder ?? "").trim() === "" ||
      !Number.isFinite(sortOrder) ||
      !Number.isInteger(sortOrder) ||
      sortOrder < 0
    ) {
      addError(errors, index, "sortOrder", "Order must be a non-negative whole number.");
    }
    if (row.isDefault) {
      defaultCount += 1;
      if (!row.isActive) {
        addError(errors, index, "isActive", "The default rate must be active.");
      }
    }

    if (nameKey) {
      const owner = nameOwners.get(nameKey);
      if (owner !== undefined) {
        addError(errors, index, "name", `Duplicates row ${owner + 1}.`);
        addError(errors, owner, "name", `Duplicates row ${index + 1}.`);
      } else {
        nameOwners.set(nameKey, index);
      }
      if (existingNames.has(nameKey)) {
        addError(errors, index, "name", "A rate with this name already exists.");
      }
    }
    if (codeKey) {
      const owner = codeOwners.get(codeKey);
      if (owner !== undefined) {
        addError(errors, index, "code", `Duplicates row ${owner + 1}.`);
        addError(errors, owner, "code", `Duplicates row ${index + 1}.`);
      } else {
        codeOwners.set(codeKey, index);
      }
      if (existingCodes.has(codeKey)) {
        addError(errors, index, "code", "A rate with this code already exists.");
      }
    }

    normalized.push({
      name,
      code,
      sortOrder,
      isActive: row.isActive,
      isDefault: row.isDefault,
    });
  });

  if (defaultCount > 1) {
    rows.forEach((row, index) => {
      if (row.isDefault) addError(errors, index, "isDefault", "Select only one default rate.");
    });
  }
  if (rows.length === 0) {
    addError(errors, 0, "name", "Add at least one rate.");
  }

  return { rows: normalized, errors };
}

export function parseRatePaste(text: string, firstSortOrder: number) {
  const rows: ParsedRateLine[] = [];
  const errors: Array<{ line: number; message: string }> = [];
  let suggestedOrder = firstSortOrder;

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = index + 1;
    if (!rawLine.trim()) return;
    const columns = rawLine.split(",").map((value) => value.trim());
    if (columns.length !== 1 && columns.length !== 3) {
      errors.push({
        line,
        message: "Use either a name or name,code,sortOrder.",
      });
      return;
    }
    const [name, suppliedCode, suppliedSortOrder] = columns;
    if (!name) {
      errors.push({ line, message: "Rate name is required." });
      return;
    }
    const code = suppliedCode
      ? suppliedCode.toUpperCase()
      : generateRateCode(name);
    if (!RATE_CODE_PATTERN.test(code)) {
      errors.push({
        line,
        message: "Code must use 1-30 letters, numbers, hyphens or underscores.",
      });
      return;
    }
    const hasSuppliedSortOrder = Boolean(suppliedSortOrder);
    const parsedSortOrder = hasSuppliedSortOrder
      ? Number(suppliedSortOrder)
      : suggestedOrder;
    if (
      !Number.isFinite(parsedSortOrder) ||
      !Number.isInteger(parsedSortOrder) ||
      parsedSortOrder < 0
    ) {
      errors.push({ line, message: "Sort order must be a non-negative whole number." });
      return;
    }
    rows.push({
      line,
      name,
      code,
      sortOrder: String(parsedSortOrder),
      isActive: true,
      isDefault: false,
      codeManuallyEdited: Boolean(suppliedCode),
    });
    suggestedOrder = nextRateSortOrder([
      { sortOrder: suggestedOrder },
      { sortOrder: parsedSortOrder },
    ]);
  });

  return { rows, errors };
}
