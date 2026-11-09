import 'dotenv/config';
import { TelegramService } from '../app/lib/telegram';

async function run() {
  console.log('--- Telegram Notification Test ---');
  console.log(`Bot Token: ${process.env.TELEGRAM_BOT_TOKEN ? 'Loaded (starts with ' + process.env.TELEGRAM_BOT_TOKEN.slice(0, 10) + '...)' : 'MISSING'}`);
  console.log(`Target Chat ID: ${process.env.TELEGRAM_CHAT_ID || 'MISSING'}`);
  console.log('----------------------------------\n');

  if (!TelegramService.isConfigured()) {
    console.error('Error: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in backend/.env');
    process.exit(1);
  }

  // Sample order to demonstrate the new formatting, spacing, vehicle info, and Telegram styling
  const sampleOrder = {
    orderNumber: 'ORD-2026-TEST',
    fsrNumber: 'FSR-99881',
    createdAt: new Date().toISOString(),
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(), // 4 hours from now
    customer: {
      name: 'Abebe Kebede',
      phone: '+251 91 123 4567',
    },
    vehicle: {
      plateNumber: JSON.stringify({
        category: '2',
        system: 'new',
        english: 'AA',
        serial: 'B12345',
        isEV: true,
      }),
      carModel: {
        name: 'Land Cruiser V8',
        brand: { name: 'Toyota' },
      },
    },
    serviceLines: [
      {
        priceAtOrderTime: 8500,
        serviceCategory: {
          nameEn: 'Infrared Heat Rejection 70%',
          service: { nameEn: 'Nano-Ceramic Window Tinting' },
        },
      },
      {
        priceAtOrderTime: 4000,
        serviceCategory: {
          nameEn: 'Custom Fit Diamond Stitch',
          service: { nameEn: 'Full Interior Floor Lamination' },
        },
      },
    ],
    standaloneLines: [
      {
        quantity: 1,
        priceAtOrderTime: 3500,
        brandName: 'SunTek',
        sizeName: '30m',
        colorName: 'Charcoal Black',
        typeName: 'Premium Carbon',
        material: {
          nameEn: 'High Performance Window Film',
          unit: 'ROLL',
        },
      },
      {
        quantity: 2,
        priceAtOrderTime: 750,
        brandName: 'Meguiar\'s',
        sizeName: '500ml',
        material: {
          nameEn: 'Leather Protection & Conditioner',
          unit: 'PCS',
        },
      },
    ],
    assignments: [
      {
        roleLabel: 'Lead Technician',
        employee: { name: 'Dawit Tadesse' },
      },
      {
        roleLabel: 'Tint Specialist',
        employee: { name: 'Ephrem Tesfaye' },
      },
    ],
    carStatuses: [
      { customName: 'Minor scratch on rear left bumper (pre-existing)' },
      { customName: 'Clean interior' },
    ],
    serviceFee: 500,
    discountAmount: 500,
    taxAmount: 0,
    downPayment: 6000,
    payments: [{ amount: 6000 }],
    notes: 'Customer requested completion before 4:00 PM for highway travel.',
  };

  console.log('Sending test order notification...');
  const success = await TelegramService.sendOrderCreatedNotification(sampleOrder);

  if (success) {
    console.log('\n✅ Successfully sent Telegram notification to chat ID:', process.env.TELEGRAM_CHAT_ID);
    console.log('Check your Telegram app to see the rendered notification!');
  } else {
    console.error('\n❌ Failed to send Telegram notification. Check the logs above for details.');
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
