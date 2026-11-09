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
    nameEn: 'Car Body Polish & Wax',
    nameAm: 'የመኪና ፖሊሽ እና ዋክስ',
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
      { name: 'Abro', type: 'Compound Polish', price: 650 },
      { name: 'Abro', type: 'Carnauba Wax', price: 700 },
    ],
  },
  {
    code: 'MAT-0003',
    nameEn: 'Leather Cleaner & Conditioner',
    nameAm: 'የቆዳ ማጽጃ እና ኮንዲሽነር',
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
    code: 'MAT-0004',
    nameEn: 'Multi-Purpose Foam Cleaner',
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
    code: 'MAT-0005',
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
    code: 'MAT-0006',
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
    code: 'MAT-0007',
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
    code: 'MAT-0008',
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
    code: 'MAT-0009',
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
    code: 'MAT-0010',
    nameEn: 'First Aid Kit',
    nameAm: 'የመጀመሪያ እርዳታ ኪት',
    unit: Unit.PCS,
    price: 800,
    lowStockThreshold: 5,
    isStandaloneSellable: true,
  },
  {
    code: 'MAT-0011',
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
    code: 'MAT-0012',
    nameEn: 'Hydraulic Trolley Jack (Cric)',
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
    code: 'MAT-0013',
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
    code: 'MAT-0014',
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
    code: 'MAT-0015',
    nameEn: 'Anti-Theft Wheel Clamp Lock',
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
    code: 'MAT-0016',
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
    code: 'MAT-0017',
    nameEn: 'Automotive Gym & Tool Bag',
    nameAm: 'የመኪና ዕቃ እና ጂም ቦርሳ',
    unit: Unit.PCS,
    price: 950,
    lowStockThreshold: 6,
    isStandaloneSellable: true,
  },

  // C. Exterior Protection & Accessories
  {
    code: 'MAT-0018',
    nameEn: 'Mud Flaps / Splash Guards',
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
    code: 'MAT-0019',
    nameEn: 'Window Sun Visor / Wind Deflector',
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
    code: 'MAT-0020',
    nameEn: 'All-Weather Car Body Cover',
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
    code: 'MAT-0021',
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
    code: 'MAT-0022',
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
    code: 'MAT-0023',
    nameEn: 'Vehicle GPS Tracker',
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
    code: 'MAT-0024',
    nameEn: 'Car Security Alarm System Kit',
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
    code: 'MAT-0025',
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
    code: 'MAT-0026',
    nameEn: 'Android Touchscreen Infotainment Display',
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
    code: 'MAT-0027',
    nameEn: 'Car Door Audio Speaker',
    nameAm: 'የመኪና በር ስፒከር',
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
    code: 'MAT-0028',
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
    code: 'MAT-0029',
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
    code: 'MAT-0030',
    nameEn: 'Smart Key Protective Cover',
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
    code: 'MAT-0031',
    nameEn: 'Universal All-Weather Floor Mats',
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
    code: 'MAT-0032',
    nameEn: 'Center Armrest Console Box',
    nameAm: 'የመኪና እጅ መደገፊያ ኮንሶል',
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
    code: 'MAT-0033',
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
    code: 'MAT-0034',
    nameEn: 'Full Set Luxury Seat Covers',
    nameAm: 'ሙሉ ሴት የቅንጦት ወንበር ልባስ',
    unit: Unit.PCS,
    price: 8500,
    lowStockThreshold: 4,
    isStandaloneSellable: true,
    brands: [
      { name: 'Universal', size: '5-Seat Set', price: 8500 },
      { name: 'Universal', size: '7-Seat Set', price: 12000 },
    ],
  },

  // F. Workshop Raw Materials (Upholstery, Detailing & PPF)
  {
    code: 'MAT-0035',
    nameEn: 'Floor Mat Material Roll (1.40m Width)',
    nameAm: 'የምንጣፍ ጥቅል (1.40 ሜትር)',
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
    ],
  },
  {
    code: 'MAT-0036',
    nameEn: 'Floor Mat Material Roll (1.60m Width)',
    nameAm: 'የምንጣፍ ጥቅል (1.60 ሜትር)',
    unit: Unit.METERS,
    price: 850,
    lowStockThreshold: 20,
    isStandaloneSellable: false,
    isBulkTracked: true,
    brands: [
      { name: 'Universal', size: '1.60m', type: 'Normal Plain (መደበኛ)', price: 850 },
      { name: 'Universal', size: '1.60m', type: 'Design (ዲዛይን)', price: 900 },
      { name: 'Universal', size: '1.60m', type: 'Factory Fabrica (ፋብሪካ)', price: 950 },
    ],
  },
  {
    code: 'MAT-0037',
    nameEn: 'Upholstery Seat Fabric & Leather',
    nameAm: 'የወንበር ታፕሴሪ ቆዳ እና ጨርቅ',
    unit: Unit.METERS,
    price: 900,
    lowStockThreshold: 25,
    isStandaloneSellable: false,
    isBulkTracked: true,
    brands: [
      { name: 'Universal', type: 'Imitation Leather (ሰው ሠራሽ ቆዳ)', price: 950 },
      { name: 'Universal', type: 'Carbon Fiber Fabric (ካርቦን ፋይበር)', price: 1100 },
      { name: 'Universal', type: 'Super Carbon Fiber (ሱፐር ካርቦን)', price: 1500 },
      { name: 'Universal', type: 'Stock Fabric (ስቶክ ጨርቅ)', price: 800 },
      { name: 'Universal', color: 'Black', type: 'Pergamod Partition (ፐርጋሞድ መከፋፈያ)', price: 850 },
      { name: 'Universal', color: 'Beige', type: 'Pergamod Partition (ፐርጋሞድ መከፋፈያ)', price: 850 },
      { name: 'Universal', color: 'Grey', type: 'Pergamod Partition (ፐርጋሞድ መከፋፈያ)', price: 850 },
    ],
  },
  {
    code: 'MAT-0038',
    nameEn: 'Steering Wheel Wrap Leather Roll',
    nameAm: 'የመሪ ልባስ ስፌት ቆዳ',
    unit: Unit.METERS,
    price: 750,
    lowStockThreshold: 10,
    isStandaloneSellable: false,
    brands: [
      { name: 'Universal', type: 'Smooth Black Nappa', price: 750 },
      { name: 'Universal', type: 'Perforated Breathable', price: 800 },
      { name: 'Universal', type: 'Carbon Texture', price: 850 },
    ],
  },
  {
    code: 'MAT-0039',
    nameEn: 'Upholstery Mastic & Spray Adhesive',
    nameAm: 'የታፕሴሪ ማስቲሽ እና ማጣበቂያ',
    unit: Unit.PCS,
    price: 500,
    lowStockThreshold: 10,
    isStandaloneSellable: false,
    brands: [
      { name: 'Gabo', type: 'Spray Mastic', price: 550 },
      { name: 'Sky', type: 'Liquid Mastic', price: 500 },
      { name: 'Universal', type: 'Heavy Contact Cement (እጭ ማጣበቂያ)', price: 700 },
    ],
  },
  {
    code: 'MAT-0040',
    nameEn: 'Foam Padding & Backing Sponge',
    nameAm: 'የስፖንጅ ፓዲንግ እና አብጀዲ',
    unit: Unit.METERS,
    price: 350,
    lowStockThreshold: 30,
    isStandaloneSellable: false,
    isBulkTracked: true,
    brands: [
      { name: 'Universal', size: '1cm', type: '1cm Foam (ባለ 1)', price: 250 },
      { name: 'Universal', size: '2cm', type: '2cm Foam (ባለ 2)', price: 350 },
      { name: 'Universal', type: 'Bonded High-Density (ቦንደድ)', price: 550 },
      { name: 'Universal', type: 'Abjedi Canvas Backing (አብጀዲ)', price: 300 },
    ],
  },
  {
    code: 'MAT-0041',
    nameEn: 'Wire Hooks & Fastener Clips',
    nameAm: 'የፌርሞ ሽቦ እና ጋንች',
    unit: Unit.PCS,
    price: 200,
    lowStockThreshold: 15,
    isStandaloneSellable: false,
    brands: [
      { name: 'Universal', type: 'Thick Wire (ወፍራሙ)', price: 250 },
      { name: 'Universal', type: 'Slim Wire (ቀጭኑ)', price: 200 },
    ],
  },
  {
    code: 'MAT-0042',
    nameEn: 'Upholstery Thread & Elastic Webbing',
    nameAm: 'የታፕሴሪ ክር እና የወገብ ላስቲክ',
    unit: Unit.PCS,
    price: 200,
    lowStockThreshold: 15,
    isStandaloneSellable: false,
    brands: [
      { name: 'Universal', type: 'Bonded Nylon Thread Spool (ክር)', price: 250 },
      { name: 'Universal', type: 'Waist Elastic Webbing (የወገብ ላስቲክ)', price: 180 },
    ],
  },
  {
    code: 'MAT-0043',
    nameEn: 'Paint Protection Film (PPF) Roll',
    nameAm: 'የፒፒኤፍ መከላከያ ፊልም ጥቅል',
    unit: Unit.METERS,
    price: 3500,
    lowStockThreshold: 15,
    isStandaloneSellable: false,
    isBulkTracked: true,
    brands: [
      { name: 'Universal', type: 'Full Body Clear TPU PPF', price: 3500 },
      { name: 'Universal', type: 'Sunroof PPF Film', price: 2800 },
      { name: 'Universal', type: 'Windshield Exterior Glass PPF', price: 4200 },
    ],
  },
  {
    code: 'MAT-0044',
    nameEn: 'PPF Squeegee & Buffer Pad Tool',
    nameAm: 'የፒፒኤፍ ስኩዊጂ እና ባፈር ፓድ',
    unit: Unit.PCS,
    price: 300,
    lowStockThreshold: 8,
    isStandaloneSellable: false,
    brands: [
      { name: 'Universal', type: 'Rubber Squeegee', price: 350 },
      { name: 'Universal', type: 'Felt Buffer Pad', price: 250 },
    ],
  },
  {
    code: 'MAT-0045',
    nameEn: 'Precision Cutter & Blades',
    nameAm: 'የመቁረጫ ምላጭ እና ካተር',
    unit: Unit.PCS,
    price: 250,
    lowStockThreshold: 10,
    isStandaloneSellable: false,
    brands: [
      { name: 'Universal', type: '30° Snap-Off Blades (Pack of 10)', price: 250 },
      { name: 'Universal', type: 'Precision Knife Handle', price: 350 },
    ],
  },
  {
    code: 'MAT-0046',
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
    code: 'MAT-0047',
    nameEn: 'PPF & Paint Polishing Compound',
    nameAm: 'የፒፒኤፍ እና ቀለም ማስተካከያ ኮምፓውንድ',
    unit: Unit.PCS,
    price: 1500,
    lowStockThreshold: 6,
    isStandaloneSellable: false,
    brands: [
      { name: 'Universal', type: 'Primary Heavy Cut', price: 1600 },
      { name: 'Universal', type: 'Secondary Medium Cut', price: 1500 },
      { name: 'Universal', type: 'Shiner Finishing Compound', price: 1400 },
    ],
  },
  {
    code: 'MAT-0048',
    nameEn: 'Machine Polishing Foam Pads',
    nameAm: 'የማሽን ፖሊሽ ፓድ',
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
    code: 'MAT-0049',
    nameEn: 'Wet & Dry Automotive Sandpaper',
    nameAm: 'የውሃ ማጠሪያ ወረቀት',
    unit: Unit.PCS,
    price: 150,
    lowStockThreshold: 20,
    isStandaloneSellable: false,
    brands: [
      { name: 'Universal', size: '1500 Grit', price: 150 },
      { name: 'Universal', size: '2000 Grit', price: 150 },
      { name: 'Universal', size: '3000 Grit', price: 150 },
    ],
  },
  {
    code: 'MAT-0050',
    nameEn: 'Horsehair Detailing & Shiner Brushes',
    nameAm: 'የዲቴይሊንግ እና ማብረቂያ ብሩሽ',
    unit: Unit.PCS,
    price: 450,
    lowStockThreshold: 8,
    isStandaloneSellable: false,
    brands: [
      { name: 'Universal', type: 'Horsehair Shiner Brush', price: 450 },
      { name: 'Universal', type: 'Detailing Crevice Brush Set', price: 600 },
    ],
  },
];

const SERVICES_CATALOG: ServiceSeedItem[] = [
  // 1. Detailing & Paint Correction
  {
    nameEn: 'Complete Auto Detailing',
    nameAm: 'የመኪና ሙሉ ጽዳት እና ዲቴይሊንግ',
    groupEn: 'Detailing & Paint Correction',
    categories: [
      {
        nameEn: 'Interior Steam & Deep Clean',
        nameAm: 'የውስጥ ጥልቅ የእንፋሎት ጽዳት',
        price: 2500,
        materialsUsed: [
          { materialCode: 'MAT-0004', quantity: 1 },
          { materialCode: 'MAT-0003', quantity: 1 },
          { materialCode: 'MAT-0046', quantity: 1 },
        ],
      },
      {
        nameEn: 'Exterior Machine Compound Polish & Wax',
        nameAm: 'የውጭ ማሽን ፖሊሽ እና ሰም',
        price: 3500,
        materialsUsed: [
          { materialCode: 'MAT-0002', quantity: 1 },
          { materialCode: 'MAT-0048', quantity: 1 },
        ],
      },
      {
        nameEn: 'Full In-and-Out Complete Detailing',
        nameAm: 'ሙሉ የውስጥና የውጭ ዲቴይሊንግ',
        price: 5000,
        materialsUsed: [
          { materialCode: 'MAT-0006', quantity: 1 },
          { materialCode: 'MAT-0004', quantity: 1 },
          { materialCode: 'MAT-0002', quantity: 1 },
          { materialCode: 'MAT-0009', quantity: 1 },
        ],
      },
    ],
  },
  {
    nameEn: 'Ceramic Coating Protection',
    nameAm: 'ሴራሚክ ኮቲንግ',
    groupEn: 'Detailing & Paint Correction',
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
    categories: [
      {
        nameEn: 'Front Bumper & Hood Package',
        nameAm: 'የፊት መከላከያ PPF',
        price: 18000,
        materialsUsed: [
          { materialCode: 'MAT-0043', quantity: 3 },
          { materialCode: 'MAT-0044', quantity: 1 },
          { materialCode: 'MAT-0045', quantity: 1 },
        ],
      },
      {
        nameEn: 'Full Vehicle Body PPF',
        nameAm: 'ሙሉ የመኪና አካል PPF',
        price: 65000,
        materialsUsed: [
          { materialCode: 'MAT-0043', quantity: 15 },
          { materialCode: 'MAT-0044', quantity: 1 },
          { materialCode: 'MAT-0045', quantity: 1 },
        ],
      },
      {
        nameEn: 'Panoramic Sunroof PPF',
        nameAm: 'የሰንሩፍ PPF',
        price: 4500,
        materialsUsed: [
          { materialCode: 'MAT-0043', quantity: 1.5 },
        ],
      },
      {
        nameEn: 'Windshield Exterior Glass PPF',
        nameAm: 'የፊት መስታወት PPF',
        price: 6000,
        materialsUsed: [
          { materialCode: 'MAT-0043', quantity: 1.5 },
        ],
      },
    ],
  },

  // 3. Window Tinting & Glass
  {
    nameEn: 'Window Tinting Application',
    nameAm: 'የመኪና መስኮት ስቲከር / ቲንት ገጠማ',
    groupEn: 'Window Tinting & Glass',
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
    categories: [
      {
        nameEn: 'Stock Fabric Tailoring',
        nameAm: 'የስቶክ ጨርቅ ወንበር ልባስ',
        price: 4500,
        materialsUsed: [
          { materialCode: 'MAT-0037', quantity: 5 },
          { materialCode: 'MAT-0040', quantity: 5 },
          { materialCode: 'MAT-0042', quantity: 1 },
          { materialCode: 'MAT-0041', quantity: 1 },
        ],
      },
      {
        nameEn: 'Imitation Leather Fitting',
        nameAm: 'ሰው ሠራሽ ቆዳ ወንበር ልባስ',
        price: 6500,
        materialsUsed: [
          { materialCode: 'MAT-0037', quantity: 5 },
          { materialCode: 'MAT-0040', quantity: 5 },
          { materialCode: 'MAT-0039', quantity: 1 },
          { materialCode: 'MAT-0042', quantity: 1 },
        ],
      },
      {
        nameEn: 'Carbon Fiber Styling Cover',
        nameAm: 'ካርቦን ፋይበር ዲዛይን ወንበር ልባስ',
        price: 8500,
        materialsUsed: [
          { materialCode: 'MAT-0037', quantity: 5 },
          { materialCode: 'MAT-0040', quantity: 5 },
          { materialCode: 'MAT-0039', quantity: 1 },
          { materialCode: 'MAT-0042', quantity: 1 },
        ],
      },
      {
        nameEn: 'Super Carbon Fiber VIP Luxury',
        nameAm: 'ሱፐር ካርቦን ቪአይፒ ወንበር ልባስ',
        price: 13000,
        materialsUsed: [
          { materialCode: 'MAT-0037', quantity: 5 },
          { materialCode: 'MAT-0040', quantity: 5 },
          { materialCode: 'MAT-0039', quantity: 1 },
          { materialCode: 'MAT-0042', quantity: 1 },
        ],
      },
      {
        nameEn: 'Pergamod Partition Cover',
        nameAm: 'ፐርጋሞድ የወንበር መከፋፈያ ልባስ',
        price: 3000,
        materialsUsed: [
          { materialCode: 'MAT-0037', quantity: 3 },
          { materialCode: 'MAT-0042', quantity: 1 },
        ],
      },
    ],
  },
  {
    nameEn: 'Steering Wheel Custom Leather Stitching',
    nameAm: 'የመሪ ልባስ ስፌት',
    groupEn: 'Custom Upholstery & Seats',
    categories: [
      {
        nameEn: 'Standard Hand-Stitch Leather',
        nameAm: 'መደበኛ በእጅ የተሰፋ መሪ',
        price: 1200,
        materialsUsed: [
          { materialCode: 'MAT-0038', quantity: 1 },
          { materialCode: 'MAT-0042', quantity: 1 },
        ],
      },
      {
        nameEn: 'Perforated / Carbon Custom Stitch',
        nameAm: 'ልዩ ፐርፎሬትድ/ካርቦን ስፌት',
        price: 1800,
        materialsUsed: [
          { materialCode: 'MAT-0038', quantity: 1 },
          { materialCode: 'MAT-0042', quantity: 1 },
        ],
      },
    ],
  },

  // 5. Floor Mats & Carpeting
  {
    nameEn: 'Custom Floor Mat Tailoring & Installation',
    nameAm: 'የወለል ምንጣፍ ስፌት እና ገጠማ',
    groupEn: 'Floor Mats & Carpeting',
    categories: [
      {
        nameEn: 'Standard 1.40m Pattern Fit',
        nameAm: 'ባለ 1.40 ሜትር የወለል ንጣፍ',
        price: 3500,
        materialsUsed: [
          { materialCode: 'MAT-0035', quantity: 3 },
          { materialCode: 'MAT-0041', quantity: 1 },
        ],
      },
      {
        nameEn: 'Heavy-Duty 1.60m Factory Fit',
        nameAm: 'ባለ 1.60 ሜትር ፋብሪካ ወለል ንጣፍ',
        price: 5500,
        materialsUsed: [
          { materialCode: 'MAT-0036', quantity: 3 },
          { materialCode: 'MAT-0041', quantity: 1 },
        ],
      },
      {
        nameEn: 'Custom Trunk / Cargo Mat',
        nameAm: 'የሻንጣ ማስቀመጫ/የኋላ ንጣፍ',
        price: 1800,
        materialsUsed: [
          { materialCode: 'MAT-0035', quantity: 1.5 },
        ],
      },
    ],
  },

  // 6. Automotive Electronics & Security
  {
    nameEn: 'Vehicle Security & Alarm Installation',
    nameAm: 'የአላርም እና ሴንትራል ሎክ ገጠማ',
    groupEn: 'Automotive Electronics & Security',
    categories: [
      {
        nameEn: 'Car Alarm System Installation',
        nameAm: 'መደበኛ አላርም ገጠማ',
        price: 1500,
        materialsUsed: [
          { materialCode: 'MAT-0024', quantity: 1 },
        ],
      },
      {
        nameEn: 'Central Door Locking Installation',
        nameAm: 'ሴንትራል ሎክ ገጠማ',
        price: 1200,
        materialsUsed: [
          { materialCode: 'MAT-0025', quantity: 1 },
        ],
      },
      {
        nameEn: 'Alarm + Central Lock Combo Installation',
        nameAm: 'አላርም እና ሴንትራል ሎክ በአንድ ላይ',
        price: 2400,
        materialsUsed: [
          { materialCode: 'MAT-0024', quantity: 1 },
          { materialCode: 'MAT-0025', quantity: 1 },
        ],
      },
    ],
  },
  {
    nameEn: 'Infotainment & Audio Setup',
    nameAm: 'የአንድሮይድ ስክሪን እና ኦዲዮ ገጠማ',
    groupEn: 'Automotive Electronics & Security',
    categories: [
      {
        nameEn: 'Android Touchscreen Installation',
        nameAm: 'የአንድሮይድ ስክሪን ገጠማ',
        price: 1500,
        materialsUsed: [
          { materialCode: 'MAT-0026', quantity: 1 },
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
          { materialCode: 'MAT-0027', quantity: 1 },
        ],
      },
    ],
  },
  {
    nameEn: 'GPS Tracker Installation',
    nameAm: 'የጂ.ፒ.ኤስ መከታተያ ገጠማ',
    groupEn: 'Automotive Electronics & Security',
    categories: [
      {
        nameEn: 'Concealed GPS Tracker Installation',
        nameAm: 'የጂ.ፒ.ኤስ መከታተያ ገጠማ',
        price: 1500,
        materialsUsed: [
          { materialCode: 'MAT-0023', quantity: 1 },
        ],
      },
    ],
  },

  // 7. Exterior Styling & Accessories Fitting
  {
    nameEn: 'Exterior Accessories Fitting',
    nameAm: 'የውጭ መከላከያ ዕቃዎች ገጠማ',
    groupEn: 'Exterior Styling & Accessories Fitting',
    categories: [
      {
        nameEn: 'Side Mirror Security Wire & Lock Installation',
        nameAm: 'የስፖኪዮ እና ፌርሞ ሽቦ ገጠማ',
        price: 600,
        materialsUsed: [
          { materialCode: 'MAT-0022', quantity: 1 },
        ],
      },
      {
        nameEn: 'Mud Flaps Installation',
        nameAm: 'የጭቃ መከላከያ ገጠማ',
        price: 500,
        materialsUsed: [
          { materialCode: 'MAT-0018', quantity: 1 },
        ],
      },
      {
        nameEn: 'Window Sun Visor Installation',
        nameAm: 'የንፋስ/ፀሐይ መከላከያ ቪዘር ገጠማ',
        price: 500,
        materialsUsed: [
          { materialCode: 'MAT-0019', quantity: 1 },
        ],
      },
    ],
  },
];

async function main() {
  console.log('🚀 Starting New Standardized Catalog Seeding (Yonatan Car Decor)...');

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

  for (const item of MATERIALS_CATALOG) {
    const material = await prisma.material.create({
      data: {
        itemCode: item.code,
        nameEn: item.nameEn,
        nameAm: item.nameAm,
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
