import fs from 'fs';
import path from 'path';
import { PrismaClient, Unit, StoreType } from '@prisma/client';

const prisma = new PrismaClient();

interface MaterialVariantSeed {
  name: string;
  size?: string;
  color?: string;
  type?: string;
  price: number;
}

interface MaterialSeedItem {
  code: string;
  nameEn: string;
  nameAm: string;
  imageUrl?: string;
  unit: Unit;
  price: number;
  lowStockThreshold: number;
  isStandaloneSellable: boolean;
  isBulkTracked?: boolean;
  brands?: MaterialVariantSeed[];
}

interface ServiceCategorySeed {
  nameEn: string;
  nameAm: string;
  price: number;
  materialsUsed?: { materialCode: string; quantity: number }[];
}

interface ServiceSeedItem {
  nameEn: string;
  nameAm: string;
  groupEn: string;
  imageUrl?: string;
  categories: ServiceCategorySeed[];
}

const SERVICE_GROUPS = [
  { nameEn: 'Detailing & Paint Correction', nameAm: 'የመኪና ጽዳትና ዲቴይሊንግ' },
  { nameEn: 'Paint Protection Film (PPF)', nameAm: 'የመኪና ቀለም እና መስታወት መከላከያ ፊልም' },
  { nameEn: 'Window Tinting & Glass', nameAm: 'የመስኮት ስቲከር እና መስታወት' },
  { nameEn: 'Custom Upholstery & Seats', nameAm: 'የወንበር ታፕሴሪ እና ስፌት ሥራ' },
  { nameEn: 'Floor Mats & Carpeting', nameAm: 'የወለል ምንጣፍ / ታፕሴሪ ሥራ' },
  { nameEn: 'Automotive Electronics & Security', nameAm: 'የኤሌክትሮኒክስ እና ደህንነት ገጠማ' },
  { nameEn: 'Exterior Styling & Accessories Fitting', nameAm: 'የውጭ ዕቃዎች ገጠማ' },
];

const MATERIALS_CATALOG: MaterialSeedItem[] = [
  // A. Car Care, Chemicals & Fluids
  {
    code: 'MAT-0001',
    nameEn: 'Air Freshener',
    nameAm: 'የመኪና ሽቶ',
    unit: Unit.PCS,
    price: 350,
    lowStockThreshold: 10,
    isStandaloneSellable: true,
    brands: [
      { name: 'Universal', type: 'Spray', price: 350 },
      { name: 'Universal', type: 'Gel', price: 400 },
      { name: 'Universal', type: 'Vent Clip / Stand', price: 450 },
    ],
  },
  {
    code: 'MAT-0002',
    nameEn: 'Car Polish',
    nameAm: 'የመኪና ፖሊሽ',
    unit: Unit.PCS,
    price: 500,
    lowStockThreshold: 8,
    isStandaloneSellable: true,
    brands: [
      { name: 'Abro', color: 'White', type: 'Color Polish', price: 550 },
      { name: 'Abro', color: 'Black', type: 'Color Polish', price: 550 },
      { name: 'Abro', color: 'Red', type: 'Color Polish', price: 550 },
      { name: 'Abro', color: 'Green', type: 'Color Polish', price: 550 },
      { name: 'Abro', color: 'Chrome / Silver', type: 'Color Polish', price: 600 },
    ],
  },
  {
    code: 'MAT-0003',
    nameEn: 'Polishing Compound',
    nameAm: 'የፖሊሽ ኮምፓውንድ',
    unit: Unit.PCS,
    price: 650,
    lowStockThreshold: 6,
    isStandaloneSellable: true,
    brands: [
      { name: 'Abro', type: 'Heavy Cut Compound', price: 650 },
      { name: 'Abro', type: 'Medium Cut Compound', price: 650 },
      { name: 'Flamingo', type: 'Rubbing Compound', price: 600 },
      { name: 'Universal', price: 550 },
    ],
  },
  {
    code: 'MAT-0004',
    nameEn: 'Wax',
    nameAm: 'የመኪና ዋክስ',
    unit: Unit.PCS,
    price: 500,
    lowStockThreshold: 8,
    isStandaloneSellable: true,
    brands: [
      { name: 'Abro', type: 'Carnauba Paste Wax', price: 550 },
      { name: 'Flamingo', type: 'Liquid Carnauba Wax', price: 500 },
      { name: 'Getsun', type: 'Hard Wax', price: 450 },
      { name: 'Universal', type: 'Spray Wax', price: 400 },
    ],
  },
  {
    code: 'MAT-0005',
    nameEn: 'Leather Cleaner',
    nameAm: 'የቆዳ ማጽጃ',
    unit: Unit.PCS,
    price: 500,
    lowStockThreshold: 5,
    isStandaloneSellable: true,
    brands: [
      { name: 'Abro', price: 500 },
      { name: 'Flamingo', price: 550 },
    ],
  },
  {
    code: 'MAT-0006',
    nameEn: 'Foam Cleaner',
    nameAm: 'ፎም ክሊነር ሁለገብ ማጽጃ',
    unit: Unit.PCS,
    price: 400,
    lowStockThreshold: 10,
    isStandaloneSellable: true,
    brands: [
      { name: 'Getsun', price: 400 },
      { name: 'Flamingo', price: 450 },
      { name: 'Abro', price: 500 },
    ],
  },
  {
    code: 'MAT-0007',
    nameEn: 'Dashboard Polish & Protectant',
    nameAm: 'የዳሽቦርድ ፖሊሽ/ቅባት',
    unit: Unit.PCS,
    price: 400,
    lowStockThreshold: 10,
    isStandaloneSellable: true,
    brands: [
      { name: 'Abro', price: 450 },
      { name: 'Haminga', price: 400 },
      { name: 'Flamingo', price: 450 },
      { name: 'AutoZone', price: 500 },
    ],
  },
  {
    code: 'MAT-0008',
    nameEn: 'Car Wash Shampoo',
    nameAm: 'የመኪና ማጠቢያ ሻምፖ',
    unit: Unit.PCS,
    price: 400,
    lowStockThreshold: 10,
    isStandaloneSellable: true,
    brands: [
      { name: 'Abro', size: '1L', price: 450 },
      { name: 'Getsun', size: '1L', price: 400 },
      { name: 'Flamingo', size: '1L', price: 450 },
      { name: 'AutoZone', size: '1L', price: 500 },
      { name: 'DulDul', size: '1L', price: 350 },
    ],
  },
  {
    code: 'MAT-0009',
    nameEn: 'Radiator Coolant Fluid',
    nameAm: 'የራዲያተር ኩላንት ውሃ',
    unit: Unit.PCS,
    price: 650,
    lowStockThreshold: 10,
    isStandaloneSellable: true,
    brands: [
      { name: 'Abro', type: '50/50 Premixed', price: 650 },
      { name: 'Abro', type: 'Standard Concentrate', price: 700 },
    ],
  },
  {
    code: 'MAT-0010',
    nameEn: 'Tire Shine Foam Spray',
    nameAm: 'የጎማ ማብረቂያ ፎም',
    unit: Unit.PCS,
    price: 350,
    lowStockThreshold: 8,
    isStandaloneSellable: true,
    brands: [
      { name: 'Flamingo', price: 400 },
      { name: 'Abro', price: 450 },
      { name: 'Getsun', price: 350 },
    ],
  },
  {
    code: 'MAT-0011',
    nameEn: 'Chamois Car Drying Towel',
    nameAm: 'የውሻ ቆዳ የመኪና ማድረቂያ',
    unit: Unit.PCS,
    price: 350,
    lowStockThreshold: 10,
    isStandaloneSellable: true,
    brands: [
      { name: 'Universal', size: 'Small', type: '3D Chamois', price: 350 },
      { name: 'Universal', size: 'Large', type: '3D Chamois', price: 550 },
      { name: 'Universal', size: 'Small', type: 'Standard Chamois', price: 300 },
      { name: 'Universal', size: 'Large', type: 'Standard Chamois', price: 450 },
    ],
  },

  // B. Emergency, Safety & Mechanical Tools
  {
    code: 'MAT-0012',
    nameEn: 'First Aid Kit',
    nameAm: 'የመጀመሪያ እርዳታ ኪት',
    unit: Unit.PCS,
    price: 800,
    lowStockThreshold: 5,
    isStandaloneSellable: true,
  },
  {
    code: 'MAT-0013',
    nameEn: 'Fire Stop Spray Extinguisher',
    nameAm: 'የእሳት ማጥፊያ ስፕሬይ',
    unit: Unit.PCS,
    price: 650,
    lowStockThreshold: 5,
    isStandaloneSellable: true,
    brands: [
      { name: 'Fire Stop', price: 650 },
    ],
  },
  {
    code: 'MAT-0014',
    nameEn: 'Crick (Jack)',
    nameAm: 'የመኪና ክሪክ (ጃክ)',
    unit: Unit.PCS,
    price: 2800,
    lowStockThreshold: 3,
    isStandaloneSellable: true,
    brands: [
      { name: 'Universal', size: '2 Ton', price: 2800 },
      { name: 'Universal', size: '3 Ton', price: 3800 },
    ],
  },
  {
    code: 'MAT-0015',
    nameEn: 'Wheel Lug Wrench (Goma Mefcha)',
    nameAm: 'የጎማ መፍቻ ቁልፍ',
    unit: Unit.PCS,
    price: 750,
    lowStockThreshold: 5,
    isStandaloneSellable: true,
    brands: [
      { name: 'Universal', type: 'Cross 4-Way', price: 750 },
      { name: 'Universal', type: 'Telescopic L-Shape', price: 850 },
    ],
  },
  {
    code: 'MAT-0016',
    nameEn: 'Portable Tire Air Compressor',
    nameAm: 'የመኪና ጎማ ኤሌክትሪክ ኮምፕረሰር',
    unit: Unit.PCS,
    price: 3800,
    lowStockThreshold: 4,
    isStandaloneSellable: true,
    brands: [
      { name: 'Universal', type: 'Single Cylinder', price: 3800 },
      { name: 'Universal', type: 'Dual Heavy Duty', price: 5500 },
    ],
  },
  {
    code: 'MAT-0017',
    nameEn: 'Anti-Theft Wheel Lock Nuts (Tire Locker)',
    nameAm: 'የጎማ መቆለፊያ',
    unit: Unit.PCS,
    price: 3200,
    lowStockThreshold: 5,
    isStandaloneSellable: true,
    brands: [
      { name: 'BYD', type: 'Yuan UP Specific', price: 3400 },
      { name: 'BYD', type: 'Song / Song Plus', price: 3400 },
      { name: 'Volkswagen', type: 'ID.6 Specific', price: 3400 },
      { name: 'Universal', type: 'Adjustable Clamp', price: 3200 },
    ],
  },
  {
    code: 'MAT-0018',
    nameEn: 'Spare Tire & Steel Wheel (Scort Tayer)',
    nameAm: 'ስኮርት ጎማ (ተጠባባቂ)',
    unit: Unit.PCS,
    price: 7500,
    lowStockThreshold: 3,
    isStandaloneSellable: true,
    brands: [
      { name: 'Universal', size: 'R14', price: 6500 },
      { name: 'Universal', size: 'R15', price: 7500 },
      { name: 'Universal', size: 'R16', price: 9000 },
      { name: 'Universal', size: 'R17', price: 11000 },
    ],
  },
  {
    code: 'MAT-0019',
    nameEn: 'Gym Bag',
    nameAm: 'የጂም ቦርሳ',
    unit: Unit.PCS,
    price: 950,
    lowStockThreshold: 6,
    isStandaloneSellable: true,
  },

  // C. Exterior Protection & Accessories
  {
    code: 'MAT-0020',
    nameEn: 'Mud Guard',
    nameAm: 'የጭቃ መከላከያ',
    unit: Unit.PCS,
    price: 1200,
    lowStockThreshold: 5,
    isStandaloneSellable: true,
    brands: [
      { name: 'Toyota', type: 'Corolla Specific', price: 1200 },
      { name: 'Toyota', type: 'Vitz Specific', price: 1200 },
      { name: 'Volkswagen', type: 'ID.6 Specific', price: 1400 },
      { name: 'Universal', type: 'Flexible Rubber', price: 1000 },
    ],
  },
  {
    code: 'MAT-0021',
    nameEn: 'Windbreak',
    nameAm: 'የንፋስ እና የፀሐይ መከላከያ (ዊንድ ብሬክ)',
    unit: Unit.PCS,
    price: 1500,
    lowStockThreshold: 5,
    isStandaloneSellable: true,
    brands: [
      { name: 'Universal', type: '4-Door Window Visor Set', price: 1500 },
      { name: 'Universal', type: 'Front Windshield Sunshade', price: 650 },
    ],
  },
  {
    code: 'MAT-0022',
    nameEn: 'Car Body Cover',
    nameAm: 'የመኪና ሙሉ ልባስ (ኮቨር)',
    unit: Unit.PCS,
    price: 2800,
    lowStockThreshold: 5,
    isStandaloneSellable: true,
    brands: [
      { name: 'Universal', size: 'M', price: 2800 },
      { name: 'Universal', size: 'L', price: 3000 },
      { name: 'Universal', size: 'XL', price: 3400 },
      { name: 'Universal', size: 'XXL', price: 3800 },
    ],
  },
  {
    code: 'MAT-0023',
    nameEn: 'License Plate Frame',
    nameAm: 'የታርጋ ፍሬም',
    unit: Unit.PCS,
    price: 450,
    lowStockThreshold: 10,
    isStandaloneSellable: true,
    brands: [
      { name: 'Universal', color: 'Black Matte', price: 450 },
      { name: 'Universal', color: 'Chrome Silver', price: 500 },
    ],
  },
  {
    code: 'MAT-0024',
    nameEn: 'Side Mirror Protection Kit & Wire (Spokiyo/Fermo)',
    nameAm: 'የስፖኪዮ እና ፌርሞ መከላከያ ሽቦ',
    unit: Unit.PCS,
    price: 850,
    lowStockThreshold: 10,
    isStandaloneSellable: true,
    brands: [
      { name: 'Universal', type: 'Heavy Wire (ወፍራሙ)', price: 1200 },
      { name: 'Universal', type: 'Slim Wire (ቀጭኑ)', price: 850 },
    ],
  },

  // D. Automotive Electronics, Audio & Security
  {
    code: 'MAT-0025',
    nameEn: 'GPS Tracker',
    nameAm: 'ጂ.ፒ.ኤስ የመኪና መከታተያ',
    unit: Unit.PCS,
    price: 4500,
    lowStockThreshold: 4,
    isStandaloneSellable: true,
    brands: [
      { name: 'Universal', type: 'Hardwired Real-Time', price: 4500 },
      { name: 'Universal', type: 'Magnetic Battery Wireless', price: 5000 },
    ],
  },
  {
    code: 'MAT-0026',
    nameEn: 'Alarm System Kit',
    nameAm: 'የመኪና አላርም ሲስተም',
    unit: Unit.PCS,
    price: 3800,
    lowStockThreshold: 4,
    isStandaloneSellable: true,
    brands: [
      { name: 'Universal', type: 'Standard One-Way', price: 3800 },
      { name: 'Universal', type: 'Two-Way Remote LCD', price: 5500 },
    ],
  },
  {
    code: 'MAT-0027',
    nameEn: 'Central Door Locking System Kit',
    nameAm: 'ሴንትራል ሎክ ሲስተም',
    unit: Unit.PCS,
    price: 1800,
    lowStockThreshold: 5,
    isStandaloneSellable: true,
    brands: [
      { name: 'Universal', type: '4-Door Complete Kit', price: 1800 },
      { name: 'Universal', type: 'Single Master Actuator', price: 500 },
    ],
  },
  {
    code: 'MAT-0028',
    nameEn: 'Android Touchscreen Display',
    nameAm: 'የአንድሮይድ ስክሪን ዲስፕሌይ',
    unit: Unit.PCS,
    price: 9500,
    lowStockThreshold: 3,
    isStandaloneSellable: true,
    brands: [
      { name: 'Universal', size: '9 Inch HD', price: 9500 },
      { name: 'Universal', size: '10 Inch HD', price: 12500 },
    ],
  },
  {
    code: 'MAT-0029',
    nameEn: 'Car Speaker',
    nameAm: 'የመኪና ስፒከር',
    unit: Unit.PCS,
    price: 1800,
    lowStockThreshold: 5,
    isStandaloneSellable: true,
    brands: [
      { name: 'Universal', size: '6.0 Inch Coaxial', price: 1800 },
      { name: 'Universal', size: '6.5 Inch Coaxial', price: 2400 },
    ],
  },
  {
    code: 'MAT-0030',
    nameEn: 'Remote Key Battery',
    nameAm: 'የርቀት መቆጣጠሪያ ባትሪ',
    unit: Unit.PCS,
    price: 100,
    lowStockThreshold: 20,
    isStandaloneSellable: true,
    brands: [
      { name: 'Universal', size: 'CR2032', price: 100 },
      { name: 'Universal', size: 'CR2025', price: 100 },
      { name: 'Universal', size: 'CR2016', price: 100 },
    ],
  },

  // E. Interior Styling & Comfort Accessories
  {
    code: 'MAT-0031',
    nameEn: 'Steering Wheel Cover (Meri Lbs)',
    nameAm: 'የመኪና መሪ ልባስ',
    unit: Unit.PCS,
    price: 650,
    lowStockThreshold: 8,
    isStandaloneSellable: true,
    brands: [
      { name: 'Universal', type: 'Hand-Stitched Leather', price: 1200 },
      { name: 'Universal', type: 'Slip-On Ergonomic', price: 650 },
      { name: 'Universal', type: 'Carbon Fiber Trim', price: 950 },
    ],
  },
  {
    code: 'MAT-0032',
    nameEn: 'Key Cover',
    nameAm: 'የቁልፍ ከቨር',
    unit: Unit.PCS,
    price: 350,
    lowStockThreshold: 10,
    isStandaloneSellable: true,
    brands: [
      { name: 'BYD', color: 'Silicone Black', price: 350 },
      { name: 'Toyota', color: 'Silicone Black', price: 350 },
      { name: 'Volkswagen', color: 'Silicone Black', price: 350 },
      { name: 'Universal', color: 'Carbon Style', price: 400 },
    ],
  },
  {
    code: 'MAT-0033',
    nameEn: 'Floor Mats',
    nameAm: 'የመኪና ወለል ምንጣፍ (መረጋገጫ)',
    unit: Unit.PCS,
    price: 2200,
    lowStockThreshold: 6,
    isStandaloneSellable: true,
    brands: [
      { name: 'Universal', type: '5-Piece Rubber All-Weather', price: 2200 },
      { name: 'Universal', type: '3D Deep Tray', price: 3200 },
    ],
  },
  {
    code: 'MAT-0034',
    nameEn: 'Armrest',
    nameAm: 'የመኪና እጅ መደገፊያ',
    unit: Unit.PCS,
    price: 2200,
    lowStockThreshold: 4,
    isStandaloneSellable: true,
    brands: [
      { name: 'Universal', type: 'Adjustable Sliding', price: 2200 },
      { name: 'Universal', type: 'Dual USB Storage', price: 2800 },
    ],
  },
  {
    code: 'MAT-0035',
    nameEn: 'Cushion Seat Cover',
    nameAm: 'የኩሽን ወንበር ልባስ',
    unit: Unit.PCS,
    price: 3800,
    lowStockThreshold: 5,
    isStandaloneSellable: true,
    brands: [
      { name: 'Universal', type: 'Universal 5-Seat Cushion', price: 3800 },
      { name: 'BYD', type: 'BYD Specific Cushion', price: 4800 },
    ],
  },
  {
    code: 'MAT-0036',
    nameEn: 'Floor Mat Material Roll',
    nameAm: 'የምንጣፍ ጥቅል',
    unit: Unit.METERS,
    price: 650,
    lowStockThreshold: 20,
    isStandaloneSellable: false,
    isBulkTracked: true,
    brands: [
      { name: 'Universal', size: '1.40m', type: 'Zigzag (ዚግዛግ)', price: 650 },
      { name: 'Universal', size: '1.40m', type: 'Charger (ቻርጀር)', price: 650 },
      { name: 'Universal', size: '1.40m', type: 'MM (ኤም ኤም)', price: 650 },
      { name: 'Universal', size: '1.40m', type: 'Number 8 (8 ቁጥር)', price: 650 },
      { name: 'Universal', size: '1.40m', type: 'Dot Dot (ነጠብጣብ)', price: 650 },
      { name: 'Universal', size: '1.60m', type: 'Normal Plain (መደበኛ)', price: 850 },
      { name: 'Universal', size: '1.60m', type: 'Design (ዲዛይን)', price: 900 },
      { name: 'Universal', size: '1.60m', type: 'Factory Fabrica (ፋብሪካ)', price: 950 },
    ],
  },
  {
    code: 'MAT-0037',
    nameEn: 'Detailing Clay Bar',
    nameAm: 'የጽዳት ክሌይ ባር',
    unit: Unit.PCS,
    price: 450,
    lowStockThreshold: 8,
    isStandaloneSellable: false,
    brands: [
      { name: 'Universal', type: 'Medium Grade', price: 450 },
      { name: 'Universal', type: 'Fine Grade', price: 500 },
    ],
  },
  {
    code: 'MAT-0038',
    nameEn: 'Polishing Pads (Cutting Pad)',
    nameAm: 'ፖሊሽ ፓድ (ከቲንግ ፓድ)',
    unit: Unit.PCS,
    price: 750,
    lowStockThreshold: 10,
    isStandaloneSellable: false,
    brands: [
      { name: 'Universal', color: 'Blue', type: 'Heavy Cutting Pad', price: 800 },
      { name: 'Universal', color: 'Brown', type: 'Medium Polishing Pad', price: 750 },
      { name: 'Universal', color: 'Yellow', type: 'Fine Finishing Pad', price: 700 },
    ],
  },
  {
    code: 'MAT-0039',
    nameEn: 'Sandpaper',
    nameAm: 'የብርጭቆ ወረቀት',
    unit: Unit.PCS,
    price: 150,
    lowStockThreshold: 20,
    isStandaloneSellable: false,
    brands: [
      { name: 'Universal', size: '1500 Grit', price: 150 },
      { name: 'Universal', size: '2000 Grit', price: 150 },
      { name: 'Universal', size: '3000 Grit', price: 150 },
    ],
  }
];

const SERVICES_CATALOG: ServiceSeedItem[] = [
  // 1. Detailing & Paint Correction
  {
    nameEn: 'Complete Auto Detailing',
    nameAm: 'የመኪና ሙሉ ጽዳት እና ዲቴይሊንግ',
    groupEn: 'Detailing & Paint Correction',
    imageUrl: 'services/complete-auto-detailing.webp',
    categories: [
      {
        nameEn: 'Interior Steam & Deep Clean',
        nameAm: 'የውስጥ ጥልቅ የእንፋሎት ጽዳት',
        price: 2500,
        materialsUsed: [
          { materialCode: 'MAT-0006', quantity: 1 },
          { materialCode: 'MAT-0005', quantity: 1 },
          { materialCode: 'MAT-0037', quantity: 1 },
        ],
      },
      {
        nameEn: 'Exterior Machine Compound Polish & Wax',
        nameAm: 'የውጭ ማሽን ፖሊሽ እና ሰም',
        price: 3500,
        materialsUsed: [
          { materialCode: 'MAT-0003', quantity: 1 },
          { materialCode: 'MAT-0004', quantity: 1 },
          { materialCode: 'MAT-0038', quantity: 1 },
        ],
      },
      {
        nameEn: 'Full In-and-Out Complete Detailing',
        nameAm: 'ሙሉ የውስጥና የውጭ ዲቴይሊንግ',
        price: 5000,
        materialsUsed: [
          { materialCode: 'MAT-0008', quantity: 1 },
          { materialCode: 'MAT-0006', quantity: 1 },
          { materialCode: 'MAT-0002', quantity: 1 },
          { materialCode: 'MAT-0004', quantity: 1 },
          { materialCode: 'MAT-0011', quantity: 1 },
        ],
      },
    ],
  },
  {
    nameEn: 'Ceramic Coating Protection',
    nameAm: 'ሴራሚክ ኮቲንግ',
    groupEn: 'Detailing & Paint Correction',
    imageUrl: 'services/ceramic-coating-protection.webp',
    categories: [
      {
        nameEn: 'Normal Ceramic Coating (1 Year)',
        nameAm: 'መደበኛ ሴራሚክ ኮቲንግ (1 ዓመት)',
        price: 8000,
      },
      {
        nameEn: 'Onyx Graphene Ceramic Coating (Multi-Year)',
        nameAm: 'ኦኒክስ ፕሪሚየም ሴራሚክ ኮቲንግ (የብዙ ዓመት)',
        price: 16000,
      },
    ],
  },

  // 2. Paint Protection Film (PPF)
  {
    nameEn: 'Paint Protection Film (PPF) Installation',
    nameAm: 'የመኪና ፒፒኤፍ ገጠማ',
    groupEn: 'Paint Protection Film (PPF)',
    imageUrl: 'services/paint-protection-film-ppf-installation.webp',
    categories: [
      {
        nameEn: 'Front Bumper & Hood Package',
        nameAm: 'የፊት መከላከያ PPF',
        price: 18000,
      },
      {
        nameEn: 'Full Vehicle Body PPF',
        nameAm: 'ሙሉ የመኪና አካል PPF',
        price: 65000,
      },
      {
        nameEn: 'Panoramic Sunroof PPF',
        nameAm: 'የሰንሩፍ PPF',
        price: 4500,
      },
      {
        nameEn: 'Windshield Exterior Glass PPF',
        nameAm: 'የፊት መስታወት PPF',
        price: 6000,
      },
    ],
  },

  // 3. Window Tinting & Glass
  {
    nameEn: 'Window Tinting Application',
    nameAm: 'የመኪና መስኮት ስቲከር / ቲንት ገጠማ',
    groupEn: 'Window Tinting & Glass',
    imageUrl: 'services/window-tinting-application.webp',
    categories: [
      {
        nameEn: 'Standard UV Sun Protection Tint',
        nameAm: 'መደበኛ ጥቁር ስቲከር',
        price: 2200,
      },
      {
        nameEn: 'High Heat Rejection Nano-Ceramic Tint',
        nameAm: 'ናኖ-ሴራሚክ ሙቀት መከላከያ ስቲከር',
        price: 5800,
      },
      {
        nameEn: 'Windshield Sun Strip Banner',
        nameAm: 'የፊት መስታወት የላይኛው ስቲከር',
        price: 800,
      },
    ],
  },

  // 4. Custom Upholstery & Seats
  {
    nameEn: 'Custom Seat Upholstery Tailoring',
    nameAm: 'የወንበር ልባስ ስፌት እና ገጠማ',
    groupEn: 'Custom Upholstery & Seats',
    imageUrl: 'services/custom-seat-upholstery-tailoring.webp',
    categories: [
      {
        nameEn: 'Stock Fabric Tailoring',
        nameAm: 'የስቶክ ጨርቅ ወንበር ልባስ',
        price: 4500,
      },
      {
        nameEn: 'Imitation Leather Fitting',
        nameAm: 'ሰው ሠራሽ ቆዳ ወንበር ልባስ',
        price: 6500,
      },
      {
        nameEn: 'Carbon Fiber Styling Cover',
        nameAm: 'ካርቦን ፋይበር ዲዛይን ወንበር ልባስ',
        price: 8500,
      },
      {
        nameEn: 'Super Carbon Fiber VIP Luxury',
        nameAm: 'ሱፐር ካርቦን ቪአይፒ ወንበር ልባስ',
        price: 13000,
      },
      {
        nameEn: 'Pergamod Partition Cover',
        nameAm: 'ፐርጋሞድ የወንበር መከፋፈያ ልባስ',
        price: 3000,
      },
    ],
  },
  {
    nameEn: 'Steering Wheel Custom Leather Stitching',
    nameAm: 'የመሪ ልባስ ስፌት',
    groupEn: 'Custom Upholstery & Seats',
    imageUrl: 'services/steering-wheel-custom-leather-stitching.webp',
    categories: [
      {
        nameEn: 'Standard Hand-Stitch Leather',
        nameAm: 'መደበኛ በእጅ የተሰፋ መሪ',
        price: 1200,
      },
      {
        nameEn: 'Perforated / Carbon Custom Stitch',
        nameAm: 'ልዩ ፐርፎሬትድ/ካርቦን ስፌት',
        price: 1800,
      },
    ],
  },

  // 5. Floor Mats & Carpeting
  {
    nameEn: 'Custom Floor Mat Tailoring & Installation',
    nameAm: 'የወለል ምንጣፍ ስፌት እና ገጠማ',
    groupEn: 'Floor Mats & Carpeting',
    imageUrl: 'services/custom-floor-mat-tailoring-installation.webp',
    categories: [
      {
        nameEn: 'Standard 1.40m Pattern Fit',
        nameAm: 'ባለ 1.40 ሜትር የወለል ንጣፍ',
        price: 3500,
        materialsUsed: [
          { materialCode: 'MAT-0036', quantity: 3 },
        ],
      },
      {
        nameEn: 'Heavy-Duty 1.60m Factory Fit',
        nameAm: 'ባለ 1.60 ሜትር ፋብሪካ ወለል ንጣፍ',
        price: 5500,
        materialsUsed: [
          { materialCode: 'MAT-0036', quantity: 3 },
        ],
      },
      {
        nameEn: 'Custom Trunk / Cargo Mat',
        nameAm: 'የሻንጣ ማስቀመጫ/የኋላ ንጣፍ',
        price: 1800,
        materialsUsed: [
          { materialCode: 'MAT-0036', quantity: 1.5 },
        ],
      },
    ],
  },

  // 6. Automotive Electronics & Security
  {
    nameEn: 'Vehicle Security & Alarm Installation',
    nameAm: 'የአላርም እና ሴንትራል ሎክ ገጠማ',
    groupEn: 'Automotive Electronics & Security',
    imageUrl: 'services/vehicle-security-alarm-installation.webp',
    categories: [
      {
        nameEn: 'Car Alarm System Installation',
        nameAm: 'መደበኛ አላርም ገጠማ',
        price: 1500,
        materialsUsed: [
          { materialCode: 'MAT-0026', quantity: 1 },
        ],
      },
      {
        nameEn: 'Central Door Locking Installation',
        nameAm: 'ሴንትራል ሎክ ገጠማ',
        price: 1200,
        materialsUsed: [
          { materialCode: 'MAT-0027', quantity: 1 },
        ],
      },
      {
        nameEn: 'Alarm + Central Lock Combo Installation',
        nameAm: 'አላርም እና ሴንትራል ሎክ በአንድ ላይ',
        price: 2400,
        materialsUsed: [
          { materialCode: 'MAT-0026', quantity: 1 },
          { materialCode: 'MAT-0027', quantity: 1 },
        ],
      },
    ],
  },
  {
    nameEn: 'Infotainment & Audio Setup',
    nameAm: 'የአንድሮይድ ስክሪን እና ኦዲዮ ገጠማ',
    groupEn: 'Automotive Electronics & Security',
    imageUrl: 'services/infotainment-audio-setup.webp',
    categories: [
      {
        nameEn: 'Android Touchscreen Installation',
        nameAm: 'የአንድሮይድ ስክሪን ገጠማ',
        price: 1500,
        materialsUsed: [
          { materialCode: 'MAT-0028', quantity: 1 },
        ],
      },
      {
        nameEn: 'Reverse Camera & Screen Combo',
        nameAm: 'የኋላ ካሜራ እና ስክሪን ገጠማ',
        price: 2200,
      },
      {
        nameEn: 'Door Speaker Upgrade & Fitting',
        nameAm: 'የበር ስፒከር ገጠማ',
        price: 800,
        materialsUsed: [
          { materialCode: 'MAT-0029', quantity: 1 },
        ],
      },
    ],
  },
  {
    nameEn: 'GPS Tracker Installation',
    nameAm: 'የጂ.ፒ.ኤስ መከታተያ ገጠማ',
    groupEn: 'Automotive Electronics & Security',
    imageUrl: 'services/gps-tracker-installation.webp',
    categories: [
      {
        nameEn: 'Concealed GPS Tracker Installation',
        nameAm: 'የጂ.ፒ.ኤስ መከታተያ ገጠማ',
        price: 1500,
        materialsUsed: [
          { materialCode: 'MAT-0025', quantity: 1 },
        ],
      },
    ],
  },

  // 7. Exterior Styling & Accessories Fitting
  {
    nameEn: 'Exterior Accessories Fitting',
    nameAm: 'የውጭ መከላከያ ዕቃዎች ገጠማ',
    groupEn: 'Exterior Styling & Accessories Fitting',
    imageUrl: 'services/exterior-accessories-fitting.webp',
    categories: [
      {
        nameEn: 'Side Mirror Security Wire & Lock Installation',
        nameAm: 'የስፖኪዮ እና ፌርሞ ሽቦ ገጠማ',
        price: 600,
        materialsUsed: [
          { materialCode: 'MAT-0024', quantity: 1 },
        ],
      },
      {
        nameEn: 'Mud Flaps Installation',
        nameAm: 'የጭቃ መከላከያ ገጠማ',
        price: 500,
        materialsUsed: [
          { materialCode: 'MAT-0020', quantity: 1 },
        ],
      },
      {
        nameEn: 'Window Sun Visor Installation',
        nameAm: 'የንፋስ/ፀሐይ መከላከያ ቪዘር ገጠማ',
        price: 500,
        materialsUsed: [
          { materialCode: 'MAT-0021', quantity: 1 },
        ],
      },
    ],
  },
];

const MATERIAL_IMAGE_MAP: Record<string, string> = {
  'MAT-0001': 'mat-0001-air-freshener.webp',
  'MAT-0002': 'mat-0002-car-polish.webp',
  'MAT-0003': 'mat-0003-polishing-compound.webp',
  'MAT-0004': 'mat-0004-wax.webp',
  'MAT-0005': 'mat-0005-leather-cleaner.webp',
  'MAT-0006': 'mat-0006-foam-cleaner.webp',
  'MAT-0007': 'mat-0007-dashboard-polish.webp',
  'MAT-0008': 'mat-0008-car-wash-shampoo.webp',
  'MAT-0009': 'mat-0009-radiator-coolant.webp',
  'MAT-0010': 'mat-0010-tire-shine-foam.webp',
  'MAT-0011': 'mat-0011-chamois-drying-towel.webp',
  'MAT-0012': 'mat-0012-first-aid-kit.webp',
  'MAT-0013': 'mat-0013-fire-stop-extinguisher.webp',
  'MAT-0014': 'mat-0014-crick-jack.webp',
  'MAT-0015': 'mat-0015-wheel-lug-wrench.webp',
  'MAT-0016': 'mat-0016-portable-air-compressor.webp',
  'MAT-0017': 'mat-0017-wheel-lock-nuts.webp',
  'MAT-0018': 'mat-0018-spare-tire-steel-wheel.webp',
  'MAT-0019': 'mat-0019-gym-bag.webp',
  'MAT-0020': 'mat-0020-mud-guard.webp',
  'MAT-0021': 'mat-0021-windbreak.webp',
  'MAT-0022': 'mat-0022-car-body-cover.webp',
  'MAT-0023': 'mat-0023-license-plate-frame.webp',
  'MAT-0024': 'mat-0024-side-mirror-protection-wire.webp',
  'MAT-0025': 'mat-0025-gps-tracker.webp',
  'MAT-0026': 'mat-0026-alarm-system-kit.webp',
  'MAT-0027': 'mat-0027-central-door-locking-kit.webp',
  'MAT-0028': 'mat-0028-android-touchscreen.webp',
  'MAT-0029': 'mat-0029-car-speaker.webp',
  'MAT-0030': 'mat-0030-remote-key-battery.webp',
  'MAT-0031': 'mat-0031-steering-wheel-cover.webp',
  'MAT-0032': 'mat-0032-key-cover.webp',
  'MAT-0033': 'mat-0033-floor-mats.webp',
  'MAT-0034': 'mat-0034-armrest.webp',
  'MAT-0035': 'mat-0035-cushion-seat-cover.webp',
  'MAT-0036': 'mat-0036-floor-mat-material-roll.webp',
  'MAT-0037': 'mat-0037-detailing-clay-bar.webp',
  'MAT-0038': 'mat-0038-polishing-pads.webp',
  'MAT-0039': 'mat-0039-sandpaper.webp',
};

async function syncCatalogAssets() {
  console.log('🖼️  Syncing catalog asset images to uploads directory...');
  const uploadsDir = path.resolve(__dirname, '../uploads');
  const r2Base = (process.env.R2_PUBLIC_BASE_URL || 'https://pub-09661d9805264d67ad957b15391bcffd.r2.dev').replace(/\/+$/, '');

  const matUploadDir = path.join(uploadsDir, 'materials');
  if (!fs.existsSync(matUploadDir)) fs.mkdirSync(matUploadDir, { recursive: true });

  const matAssetDir = path.resolve(__dirname, '../../Materials-Asset');
  if (fs.existsSync(matAssetDir)) {
    const files = fs.readdirSync(matAssetDir).filter((f) => f.endsWith('.webp'));
    for (const file of files) {
      fs.copyFileSync(path.join(matAssetDir, file), path.join(matUploadDir, file));
    }
    console.log(`  ✓ Synced ${files.length} material images from Materials-Asset to uploads/materials`);
  } else if (process.env.USE_R2 === 'true' || process.env.NODE_ENV === 'production') {
    console.log(`  ℹ Materials-Asset not found locally. Attempting download from Cloudflare R2...`);
    let downloaded = 0;
    for (const fileName of Object.values(MATERIAL_IMAGE_MAP)) {
      const dest = path.join(matUploadDir, fileName);
      if (!fs.existsSync(dest)) {
        try {
          const res = await fetch(`${r2Base}/materials/${fileName}`);
          if (res.ok) {
            fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
            downloaded++;
          }
        } catch {
          // Fallback will redirect on HTTP request anyway
        }
      }
    }
    if (downloaded > 0) {
      console.log(`  ✓ Downloaded ${downloaded} material images from Cloudflare R2`);
    }
  }

  const srvUploadDir = path.join(uploadsDir, 'services');
  if (!fs.existsSync(srvUploadDir)) fs.mkdirSync(srvUploadDir, { recursive: true });

  const srvAssetDir = path.resolve(__dirname, '../../Services-Asset');
  if (fs.existsSync(srvAssetDir)) {
    const files = fs.readdirSync(srvAssetDir).filter((f) => f.endsWith('.webp'));
    for (const file of files) {
      fs.copyFileSync(path.join(srvAssetDir, file), path.join(srvUploadDir, file));
    }
    console.log(`  ✓ Synced ${files.length} service images from Services-Asset to uploads/services`);
  } else if (process.env.USE_R2 === 'true' || process.env.NODE_ENV === 'production') {
    console.log(`  ℹ Services-Asset not found locally. Attempting download from Cloudflare R2...`);
    let downloaded = 0;
    for (const svc of SERVICES_CATALOG) {
      if (svc.imageUrl) {
        const fileName = path.basename(svc.imageUrl);
        const dest = path.join(srvUploadDir, fileName);
        if (!fs.existsSync(dest)) {
          try {
            const res = await fetch(`${r2Base}/services/${fileName}`);
            if (res.ok) {
              fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
              downloaded++;
            }
          } catch {
            // Fallback will redirect on HTTP request anyway
          }
        }
      }
    }
    if (downloaded > 0) {
      console.log(`  ✓ Downloaded ${downloaded} service images from Cloudflare R2`);
    }
  }
}

async function main() {
  console.log('🚀 Starting New Standardized Catalog Seeding (Yonatan Car Decor)...');

  // Auto-sync asset images
  await syncCatalogAssets();

  // 1. Cleanly purge old catalog and transaction tables
  console.log('🧹 Purging old mock materials, services, and transaction lines...');
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE 
      "DailyStats",
      "DirectSalePayment",
      "DirectSaleLine",
      "DirectSale",
      "OrderPayment",
      "OrderAdditionalCharge",
      "OrderAssignment",
      "OrderCarStatus",
      "OrderServiceMaterialDeduction",
      "OrderStandaloneItemLine",
      "OrderServiceLine",
      "Order",
      "ServiceCategoryMaterialUsage",
      "ServiceCategory",
      "Service",
      "ServiceGroup",
      "PriceHistory",
      "MaterialBrandStock",
      "MaterialStock",
      "StoreTransfer",
      "StockCount",
      "Restock",
      "StockAdjustment",
      "MaterialBrand",
      "Material"
    CASCADE;
  `);

  // 2. Ensure MAIN and MINI stores exist
  console.log('🏬 Ensuring stores exist...');
  const mainStore = await prisma.store.upsert({
    where: { type: StoreType.MAIN },
    update: {},
    create: { name: 'Main Store (Bulk Warehouse)', type: StoreType.MAIN },
  });

  const miniStore = await prisma.store.upsert({
    where: { type: StoreType.MINI },
    update: {},
    create: { name: 'Mini Store (Showroom / Floor)', type: StoreType.MINI },
  });

  // 3. Seed Materials and MaterialBrands with 0 Initial Stock
  console.log(`📦 Seeding ${MATERIALS_CATALOG.length} standardized materials with variants (0 initial stock, ready for counting)...`);
  const materialCodeMap = new Map<string, string>(); // code -> id

  const matAssetDir = path.resolve(__dirname, '../../Materials-Asset');
  const matUploadDir = path.resolve(__dirname, '../uploads/materials');
  const matAssetFiles = fs.existsSync(matAssetDir)
    ? fs.readdirSync(matAssetDir).filter((f) => f.endsWith('.webp'))
    : fs.existsSync(matUploadDir)
      ? fs.readdirSync(matUploadDir).filter((f) => f.endsWith('.webp'))
      : [];

  for (const item of MATERIALS_CATALOG) {
    const codePrefix = `${item.code.toLowerCase()}-`;
    const matchedAssetFile = matAssetFiles.find((f) => f.startsWith(codePrefix)) || MATERIAL_IMAGE_MAP[item.code];
    const finalImageUrl = item.imageUrl || (matchedAssetFile ? `materials/${matchedAssetFile}` : null);

    const material = await prisma.material.create({
      data: {
        itemCode: item.code,
        nameEn: item.nameEn,
        nameAm: item.nameAm,
        imageUrl: finalImageUrl,
        unit: item.unit,
        currentPrice: item.price,
        lowStockThreshold: item.lowStockThreshold,
        isStandaloneSellable: item.isStandaloneSellable,
        isBulkTracked: item.isBulkTracked ?? false,
      },
    });

    materialCodeMap.set(item.code, material.id);

    // Initial stock quantities are 0 (stock will be added by counting / restocking)
    if (item.brands && item.brands.length > 0) {
      for (let i = 0; i < item.brands.length; i++) {
        const b = item.brands[i];
        const brandRecord = await prisma.materialBrand.create({
          data: {
            materialId: material.id,
            name: b.name.trim(),
            size: b.size?.trim() || null,
            color: b.color?.trim() || null,
            type: b.type?.trim() || null,
            price: b.price,
          },
        });

        // Initialize brand stock at 0 for both stores
        await prisma.materialBrandStock.createMany({
          data: [
            { materialBrandId: brandRecord.id, storeId: mainStore.id, quantity: 0 },
            { materialBrandId: brandRecord.id, storeId: miniStore.id, quantity: 0 },
          ],
        });
      }

      // Initialize aggregate materialStock at 0
      await prisma.materialStock.createMany({
        data: [
          { materialId: material.id, storeId: mainStore.id, quantity: 0 },
          { materialId: material.id, storeId: miniStore.id, quantity: 0 },
        ],
      });
    } else {
      // Single / universal material stock initialized at 0
      await prisma.materialStock.createMany({
        data: [
          { materialId: material.id, storeId: mainStore.id, quantity: 0 },
          { materialId: material.id, storeId: miniStore.id, quantity: 0 },
        ],
      });
    }
  }

  console.log(`  ✓ Successfully seeded ${MATERIALS_CATALOG.length} materials with 0 initial stock in MAIN and MINI stores.`);

  // 4. Seed Service Groups
  console.log(`📂 Seeding ${SERVICE_GROUPS.length} service groups...`);
  const groupMap = new Map<string, string>(); // nameEn -> id

  for (const g of SERVICE_GROUPS) {
    const groupRecord = await prisma.serviceGroup.create({
      data: {
        nameEn: g.nameEn,
        nameAm: g.nameAm,
      },
    });
    groupMap.set(g.nameEn, groupRecord.id);
  }

  // 5. Seed Services, Categories, and Material Usage Links
  console.log(`🛠️ Seeding ${SERVICES_CATALOG.length} services with categories and material usage links...`);
  let totalCategories = 0;
  let totalUsageLinks = 0;

  for (const svc of SERVICES_CATALOG) {
    const groupId = groupMap.get(svc.groupEn);
    if (!groupId) {
      throw new Error(`Service Group "${svc.groupEn}" not found for service "${svc.nameEn}"`);
    }

    const serviceRecord = await prisma.service.create({
      data: {
        nameEn: svc.nameEn,
        nameAm: svc.nameAm,
        imageUrl: svc.imageUrl || null,
        serviceGroupId: groupId,
      },
    });

    for (const cat of svc.categories) {
      totalCategories++;
      const categoryRecord = await prisma.serviceCategory.create({
        data: {
          serviceId: serviceRecord.id,
          nameEn: cat.nameEn,
          nameAm: cat.nameAm,
          price: cat.price,
        },
      });

      if (cat.materialsUsed && cat.materialsUsed.length > 0) {
        for (const usage of cat.materialsUsed) {
          const materialId = materialCodeMap.get(usage.materialCode);
          if (materialId) {
            await prisma.serviceCategoryMaterialUsage.create({
              data: {
                serviceCategoryId: categoryRecord.id,
                materialId: materialId,
                quantityUsed: usage.quantity,
              },
            });
            totalUsageLinks++;
          } else {
            console.warn(`  ⚠️ Warning: Material code "${usage.materialCode}" not found for category "${cat.nameEn}"`);
          }
        }
      }
    }
  }

  console.log(`  ✓ Successfully seeded ${SERVICES_CATALOG.length} services across ${SERVICE_GROUPS.length} groups.`);
  console.log(`  ✓ Created ${totalCategories} service categories and ${totalUsageLinks} material usage links.`);
  console.log('\n✨ Catalog seeding complete! All materials and services have been replaced successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding catalog:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
