import { Unit } from '@prisma/client';
import { isUnitIntegerOnly, validateQuantityForUnit } from '../units';

describe('Unit decimal vs integer rules', () => {
  describe('isUnitIntegerOnly', () => {
    it('returns true for PCS', () => {
      expect(isUnitIntegerOnly(Unit.PCS)).toBe(true);
      expect(isUnitIntegerOnly('PCS')).toBe(true);
      expect(isUnitIntegerOnly('pcs')).toBe(true);
    });

    it('returns false for METERS and LITERS', () => {
      expect(isUnitIntegerOnly(Unit.METERS)).toBe(false);
      expect(isUnitIntegerOnly('METERS')).toBe(false);
      expect(isUnitIntegerOnly(Unit.LITERS)).toBe(false);
      expect(isUnitIntegerOnly('LITERS')).toBe(false);
    });

    it('returns false for null or undefined', () => {
      expect(isUnitIntegerOnly(null)).toBe(false);
      expect(isUnitIntegerOnly(undefined)).toBe(false);
      expect(isUnitIntegerOnly('')).toBe(false);
    });
  });

  describe('validateQuantityForUnit', () => {
    it('allows integer quantities for PCS', () => {
      expect(() => validateQuantityForUnit(1, Unit.PCS)).not.toThrow();
      expect(() => validateQuantityForUnit(100, 'PCS')).not.toThrow();
      expect(() => validateQuantityForUnit(0, Unit.PCS)).not.toThrow();
      expect(() => validateQuantityForUnit(-5, Unit.PCS)).not.toThrow();
    });

    it('rejects decimal quantities for PCS (e.g. 4.5)', () => {
      expect(() => validateQuantityForUnit(4.5, Unit.PCS)).toThrow(
        /Quantity for items measured in PCS must be a whole number/
      );
      expect(() => validateQuantityForUnit(0.1, 'PCS')).toThrow(
        /Quantity for items measured in PCS must be a whole number/
      );
      expect(() => validateQuantityForUnit(-2.5, Unit.PCS)).toThrow(
        /Quantity for items measured in PCS must be a whole number/
      );
    });

    it('allows decimal quantities for METERS and LITERS', () => {
      expect(() => validateQuantityForUnit(4.5, Unit.METERS)).not.toThrow();
      expect(() => validateQuantityForUnit(0.25, Unit.METERS)).not.toThrow();
      expect(() => validateQuantityForUnit(2.75, Unit.LITERS)).not.toThrow();
      expect(() => validateQuantityForUnit(10.5, 'LITERS')).not.toThrow();
    });

    it('custom fieldName is reflected in error message', () => {
      expect(() => validateQuantityForUnit(1.2, Unit.PCS, 'Restock quantity')).toThrow(
        /Restock quantity for items measured in PCS must be a whole number/
      );
    });
  });
});

