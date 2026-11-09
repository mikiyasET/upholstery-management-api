import {
  parsePlateNumber,
  formatPlateNumber,
  formatVehicleTitle,
  formatETB,
  TelegramService,
} from '../telegram';

describe('Telegram Formatting & Notification Service', () => {
  describe('parsePlateNumber & formatPlateNumber', () => {
    it('parses raw JSON plate numbers correctly', () => {
      const rawJson = JSON.stringify({
        category: '2',
        system: 'old',
        amharic: 'ኢትዮጵያ',
        english: 'AA',
        serial: 'B12345',
      });
      const formatted = formatPlateNumber(rawJson);
      expect(formatted).toBe('Code 2 • AA B12345');
    });

    it('formats plate with EV tag when isEV is true', () => {
      const rawJson = JSON.stringify({
        category: '2',
        system: 'new',
        english: 'AA',
        serial: 'C99999',
        isEV: true,
      });
      const formatted = formatPlateNumber(rawJson);
      expect(formatted).toBe('Code 2 • AA C99999 ⚡[EV]');
    });

    it('formats plate with PD tag when isPD is true', () => {
      const rawJson = JSON.stringify({
        category: '3',
        english: 'ET',
        serial: 'D11111',
        isPD: true,
      });
      const formatted = formatPlateNumber(rawJson);
      expect(formatted).toBe('Code 3 • ET D11111 🛡️[PD]');
    });

    it('formats code prefix plate numbers', () => {
      expect(formatPlateNumber('Code 2 - AA B12345')).toBe('Code 2 • AA B12345');
      expect(formatPlateNumber('Code UN - 00123')).toBe('UN • ET 00123');
    });

    it('formats region prefix plate numbers', () => {
      expect(formatPlateNumber('AA 2-12345')).toBe('Code 2 • AA 12345');
    });

    it('formats simple hyphenated plate numbers', () => {
      expect(formatPlateNumber('2-B12345')).toBe('Code 2 • ET B12345');
    });

    it('returns N/A when plate string is missing', () => {
      expect(formatPlateNumber(undefined)).toBe('N/A');
      expect(formatPlateNumber('')).toBe('N/A');
    });
  });

  describe('formatVehicleTitle', () => {
    it('combines brand and model cleanly', () => {
      const vehicle = {
        carModel: {
          name: 'Corolla',
          brand: { name: 'Toyota' },
        },
      };
      expect(formatVehicleTitle(vehicle)).toBe('Toyota Corolla');
    });

    it('prevents duplicating brand if model already starts with brand name', () => {
      const vehicle = {
        carModel: {
          name: 'Toyota Land Cruiser V8',
          brand: { name: 'Toyota' },
        },
      };
      expect(formatVehicleTitle(vehicle)).toBe('Toyota Land Cruiser V8');
    });

    it('handles vehicle with only model name', () => {
      const vehicle = {
        carModel: { name: 'Tucson' },
      };
      expect(formatVehicleTitle(vehicle)).toBe('Tucson');
    });

    it('handles null vehicle gracefully', () => {
      expect(formatVehicleTitle(null)).toBe('Vehicle (Not Specified)');
    });
  });

  describe('formatETB', () => {
    it('formats numbers into standard ETB currency with 2 decimals', () => {
      expect(formatETB(12500)).toBe('12,500.00 ETB');
      expect(formatETB(0)).toBe('0.00 ETB');
      expect(formatETB('450.5')).toBe('450.50 ETB');
    });
  });

  describe('sendOrderCreatedNotification formatting structure', () => {
    let sentMessage = '';

    beforeEach(() => {
      sentMessage = '';
      jest.spyOn(TelegramService, 'sendMessage').mockImplementation(async (text: string) => {
        sentMessage = text;
        return true;
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('formats order notification with human-readable vehicle info, spacious sections, and modern styling', async () => {
      const mockOrder = {
        orderNumber: 'ORD-2026-0099',
        fsrNumber: 'FSR-77123',
        createdAt: '2026-11-09T10:00:00Z',
        customer: {
          name: 'Abebe Bikila',
          phone: '+251911223344',
        },
        vehicle: {
          plateNumber: JSON.stringify({
            category: '2',
            english: 'AA',
            serial: 'B99887',
          }),
          carModel: {
            name: 'Hilux',
            brand: { name: 'Toyota' },
          },
        },
        serviceLines: [
          {
            priceAtOrderTime: 5000,
            serviceCategory: {
              nameEn: 'Ceramic 70%',
              service: { nameEn: 'Full Window Tint' },
            },
          },
        ],
        standaloneLines: [
          {
            quantity: 2,
            priceAtOrderTime: 1500,
            brandName: 'SunTek',
            sizeName: '30m',
            colorName: 'Charcoal',
            material: {
              nameEn: 'Window Tint Roll',
              unit: 'ROLL',
            },
          },
        ],
        assignments: [
          {
            roleLabel: 'Master Upholsterer',
            employee: { name: 'Dawit Tadesse' },
          },
        ],
        serviceFee: 500,
        discountAmount: 200,
        taxAmount: 0,
        downPayment: 3000,
        payments: [{ amount: 3000 }],
        notes: 'Handle rear tailgate with care',
      };

      const result = await TelegramService.sendOrderCreatedNotification(mockOrder);
      expect(result).toBe(true);

      // Verify Header and Order ID
      expect(sentMessage).toContain('NEW WORK ORDER CREATED');
      expect(sentMessage).toContain('#ORD-2026-0099');
      expect(sentMessage).toContain('FSR-77123');

      // Verify Human-readable Vehicle Info (NOT raw JSON)
      expect(sentMessage).not.toContain('{"category"');
      expect(sentMessage).toContain('Toyota Hilux');
      expect(sentMessage).toContain('Code 2 • AA B99887');

      // Verify Customer
      expect(sentMessage).toContain('Abebe Bikila');
      expect(sentMessage).toContain('+251911223344');

      // Verify Work & Services
      expect(sentMessage).toContain('WORK &amp; SERVICES');
      expect(sentMessage).toContain('Full Window Tint');
      expect(sentMessage).toContain('5,000.00 ETB');

      // Verify Parts & Materials with specs and spacing
      expect(sentMessage).toContain('PARTS &amp; MATERIALS');
      expect(sentMessage).toContain('Window Tint Roll');
      expect(sentMessage).toContain('SunTek • 30m • Charcoal');
      expect(sentMessage).toContain('2 roll');
      expect(sentMessage).toContain('3,000.00 ETB');

      // Verify Financial Breakdown
      expect(sentMessage).toContain('FINANCIAL &amp; PAYMENT BREAKDOWN:');
      expect(sentMessage).toContain('Services Subtotal:</b> <code>5,000.00 ETB</code>');
      expect(sentMessage).toContain('Materials Subtotal:</b> <code>3,000.00 ETB</code>');
      expect(sentMessage).toContain('Service Fee:</b> <code>500.00 ETB</code>');
      expect(sentMessage).toContain('Discount:</b> <code>-200.00 ETB</code>');
      // Gross total = 5000 + 3000 + 500 = 8500 - 200 = 8300
      expect(sentMessage).toContain('GRAND TOTAL:</b> <b><code>8,300.00 ETB</code></b>');
      expect(sentMessage).toContain('Down Payment:</b> <code>3,000.00 ETB</code>');
      // Balance due = 8300 - 3000 = 5300
      expect(sentMessage).toContain('Balance Remaining:</b> <b><code>5,300.00 ETB</code></b>');
      expect(sentMessage).toContain('PARTIALLY PAID');

      // Verify Notes
      expect(sentMessage).toContain('Handle rear tailgate with care');

      // Verify Telegram Modern tags
      expect(sentMessage).toContain('<blockquote>');
      expect(sentMessage).toContain('<blockquote expandable>');
      expect(sentMessage).toContain('<tg-emoji');
      expect(sentMessage).toContain('<code>');
    });
  });
});

