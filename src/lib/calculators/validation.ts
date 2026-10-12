/**
 * Shared numeric validation helpers for the construction calculators
 * (concrete volume, concrete dosage, HA steel weight, welded mesh).
 *
 * Rules enforced everywhere (see project requirements):
 * - Reject negative values.
 * - Treat an empty/missing input as "required", not as 0 or NaN.
 * - Reject NaN / Infinity.
 * - Never silently clamp a bad value to something plausible-looking.
 */

export type CalculationErrorCode = "required" | "invalid" | "negative" | "not-integer" | "range";

export class CalculationError extends Error {
  code: CalculationErrorCode;
  field?: string;

  constructor(code: CalculationErrorCode, field?: string) {
    super(`${code}${field ? `:${field}` : ""}`);
    this.name = "CalculationError";
    this.code = code;
    this.field = field;
  }
}

/**
 * Parses a user-entered numeric string into a finite number, or `null` when the
 * input is empty. Accepts a comma as a decimal separator (common in fr/ar locales).
 * Never returns NaN or Infinity - both collapse to `null` so callers can treat
 * them the same way as "not provided" and raise a proper validation error.
 */
export function parseNumberInput(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  if (raw == null) return null;

  const trimmed = String(raw).trim();
  if (trimmed === "") return null;

  const normalized = trimmed.replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Validates a required numeric field that may legitimately be zero
 * (e.g. a dimension left at 0 while the user is still filling the form).
 * Rejects: missing input, non-finite numbers, negative numbers.
 */
export function requireNonNegative(value: number | null | undefined, field: string): number {
  if (value === null || value === undefined) throw new CalculationError("required", field);
  if (!Number.isFinite(value)) throw new CalculationError("invalid", field);
  if (value < 0) throw new CalculationError("negative", field);
  return value;
}

/** Same as {@link requireNonNegative} but additionally rejects 0. */
export function requirePositive(value: number | null | undefined, field: string): number {
  const v = requireNonNegative(value, field);
  if (v === 0) throw new CalculationError("required", field);
  return v;
}

/** Validates a non-negative integer count (e.g. number of bars). Decimals are rejected. */
export function requireNonNegativeInteger(value: number | null | undefined, field: string): number {
  const v = requireNonNegative(value, field);
  if (!Number.isInteger(v)) throw new CalculationError("not-integer", field);
  return v;
}
