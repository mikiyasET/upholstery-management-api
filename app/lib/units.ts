import { Unit } from '@prisma/client';

/**
 * Returns true if the unit is discrete/count-based (PCS) and cannot have fractional/decimal quantities.
 */
export function isUnitIntegerOnly(unit: Unit | string | undefined | null): boolean {
  if (!unit) return false;
  const normalized = String(unit).toUpperCase().trim();
  return normalized === Unit.PCS || normalized === 'PCS';
}

/**
 * Validates that quantity is an integer if the unit is PCS.
 * Throws an Error if validation fails.
 */
export function validateQuantityForUnit(
  quantity: number | undefined | null,
  unit: Unit | string | undefined | null,
  fieldName = 'Quantity'
): void {
  if (quantity === undefined || quantity === null) return;
  if (isUnitIntegerOnly(unit)) {
    if (!Number.isInteger(Number(quantity))) {
      throw new Error(`${fieldName} for items measured in PCS must be a whole number (no decimals allowed)`);
    }
  }
}

