import { PrismaClient, UserRole, StoreType, Unit } from '@prisma/client';
import * as argon2 from 'argon2';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

/**
 * Resolves the Cloudflare R2 car-assets base URL.
 * Supports R2_PUBLIC_BASE_URL (e.g. "https://pub-xxxxxx.r2.dev" or "https://pub-xxxxxx.r2.dev/car-assets").
 * Ensures the returned URL points directly to the /car-assets prefix without duplicate trailing slashes.
 */
function getCarAssetsBaseUrl(): string {
  const rawBase = (process.env.R2_PUBLIC_BASE_URL || 'https://pub-yonatan-car-decor.r2.dev').trim();
  const trimmed = rawBase.replace(/\/+$/, '');
  if (trimmed.toLowerCase().endsWith('/car-assets')) {
    return trimmed;
  }
  return `${trimmed}/car-assets`;
}

/**
 * Normalizes incoming image paths from cars.json into valid public Cloudflare R2 URLs.
 * Strips legacy "Cars-Asset/", "cars-asset/", "car-assets/", leading/trailing slashes,
 * and duplicate brand directory prefixes.
 */
function normalizeR2Url(
  carAssetsBase: string,
  category: 'brands' | 'models',
  assetFolder: string | undefined,
  rawPath: string | undefined
): string | undefined {
  if (!rawPath || typeof rawPath !== 'string') return undefined;

  const trimmed = rawPath.trim();
  if (!trimmed) return undefined;

  // Already a full remote URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // 1. Normalize backslashes and strip leading/trailing slashes
  let clean = trimmed.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

  // 2. Strip legacy "Cars-Asset/" prefix (case-insensitive)
  clean = clean.replace(/^cars-asset\//i, '');

  // 3. Strip "car-assets/" prefix if already present (case-insensitive)
  clean = clean.replace(/^car-assets\//i, '');

  if (category === 'brands') {
    // Strip "brands/" prefix if already present
    clean = clean.replace(/^brands\//i, '');
    return `${carAssetsBase}/brands/${clean}`;
  } else {
    // category === 'models'
    // Strip "models/" prefix if already present
    clean = clean.replace(/^models\//i, '');

    const folder = (assetFolder || '').trim();
    // If clean already starts with the brand folder (e.g. "Toyota/corolla.png"), strip it
    if (folder && clean.toLowerCase().startsWith(`${folder.toLowerCase()}/`)) {
      clean = clean.slice(folder.length + 1);
    }

    return folder ? `${carAssetsBase}/models/${folder}/${clean}` : `${carAssetsBase}/models/${clean}`;
  }
}

/**
 * Copies an image from Cars-Asset to the uploads directory with a UUID filename (for local dev mode).
 * Returns the relative path (e.g. "cars/brands/uuid.png") to store in the DB.
 */
function copyImageToUploads(
  sourceDir: string,
  imageFileName: string,
  uploadsSubfolder: string
): string | undefined {
  const sourcePath = path.join(sourceDir, imageFileName);
  if (!fs.existsSync(sourcePath)) {
    console.warn(`  ⚠ Image not found: ${sourcePath}`);
    return undefined;
  }

  const ext = path.extname(imageFileName);
  const uuidName = `${uuidv4()}${ext}`;
  const uploadsDir = path.join(process.cwd(), 'uploads', uploadsSubfolder);

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const destPath = path.join(uploadsDir, uuidName);
  fs.copyFileSync(sourcePath, destPath);
  console.log(`  ✓ Copied ${imageFileName} → ${uploadsSubfolder}/${uuidName}`);

  return `${uploadsSubfolder}/${uuidName}`;
}

async function main() {
  const phone = "0941398934";
  console.log('Starting seed...');

  // 1. Create Stores
  console.log('Seeding stores...');
  const mainStore = await prisma.store.upsert({
    where: { type: StoreType.MAIN },
    update: {},
    create: { name: 'Main Store', type: StoreType.MAIN },
  });

  const miniStore = await prisma.store.upsert({
    where: { type: StoreType.MINI },
    update: {},
    create: { name: 'Mini Store', type: StoreType.MINI },
  });

  // 2. Create Admin User
  console.log('Seeding admin user...');
  const passwordHash = await argon2.hash('12341234');
  const adminEmployee = await prisma.employee.create({
    data: {
      name: 'System Admin',
      phone: phone,
    }
  });

  const adminUser = await prisma.user.upsert({
    where: { phone: phone },
    update: {},
    create: {
      name: 'System Admin',
      phone: phone,
      passwordHash,
      role: UserRole.ADMIN,
      employeeId: adminEmployee.id,
    },
  });


  // 3. Create Car Catalog from cars.json
  console.log('Seeding car catalog from cars.json...');
  const carsFilePath = fs.existsSync(path.join(process.cwd(), 'cars.json'))
    ? path.join(process.cwd(), 'cars.json')
    : path.join(process.cwd(), '../cars.json');

  const isProduction = process.env.NODE_ENV === 'production' || process.env.USE_R2 === 'true';

  // In production, we completely remove local filesystem checks for Cars-Asset and pull from Cloudflare R2.
  // In development, it pulls from the local filesystem (Cars-Asset) if available, unless USE_R2 is explicitly enabled.
  const localAssetsBasePath = !isProduction
    ? (fs.existsSync(path.join(process.cwd(), 'Cars-Asset'))
        ? path.join(process.cwd(), 'Cars-Asset')
        : fs.existsSync(path.join(process.cwd(), '../Cars-Asset'))
        ? path.join(process.cwd(), '../Cars-Asset')
        : null)
    : null;

  const useR2 = isProduction || !localAssetsBasePath;
  const carAssetsBase = getCarAssetsBaseUrl();

  console.log(`Car Catalog Seed Mode: ${useR2 ? `Cloudflare R2 (${carAssetsBase})` : `Local Filesystem (${localAssetsBasePath})`}`);

  if (fs.existsSync(carsFilePath)) {
    const carsData = JSON.parse(fs.readFileSync(carsFilePath, 'utf-8'));

    // Clean up any formerly miscategorized models under BYD (Denza, Leopard, Yangwang)
    const bydBrand = await prisma.carBrand.findFirst({ where: { name: 'BYD' } });
    if (bydBrand) {
      const miscategorized = await prisma.carModel.findMany({
        where: {
          brandId: bydBrand.id,
          OR: [
            { name: { startsWith: 'Denza' } },
            { name: { startsWith: 'Leopard' } },
            { name: { startsWith: 'Yangwang' } },
          ],
        },
        include: { _count: { select: { vehicles: true } } },
      });

      for (const m of miscategorized) {
        if (m._count.vehicles === 0) {
          await prisma.carModel.delete({ where: { id: m.id } });
          console.log(`  ✓ Removed miscategorized model from BYD: ${m.name}`);
        }
      }
    }

    for (const brandData of carsData.brands) {
      let brand = await prisma.carBrand.findFirst({
        where: { name: brandData.name },
      });

      let brandLogoPath: string | undefined;

      if (useR2) {
        brandLogoPath = normalizeR2Url(carAssetsBase, 'brands', undefined, brandData.logo);
      } else if (localAssetsBasePath && brandData.logo) {
        const brandLogoMissing = brand?.logoUrl ? !fs.existsSync(path.join(process.cwd(), 'uploads', brand.logoUrl)) : false;
        if (!brand?.logoUrl || brandLogoMissing) {
          brandLogoPath = copyImageToUploads(
            path.join(localAssetsBasePath, 'brands'),
            brandData.logo,
            'cars/brands'
          );
        } else {
          brandLogoPath = brand.logoUrl;
        }
      }

      if (!brand) {
        brand = await prisma.carBrand.create({
          data: {
            name: brandData.name,
            logoUrl: brandLogoPath || null,
          },
        });
        console.log(`Created brand: ${brandData.name} (logo: ${brandLogoPath || 'none'})`);
      } else if (brandLogoPath && brand.logoUrl !== brandLogoPath) {
        brand = await prisma.carBrand.update({
          where: { id: brand.id },
          data: { logoUrl: brandLogoPath },
        });
        console.log(`Updated brand logo: ${brandData.name} → ${brandLogoPath}`);
      }

      if (brandData.models && Array.isArray(brandData.models)) {
        const modelsAssetDir = localAssetsBasePath
          ? path.join(localAssetsBasePath, 'models', brandData.assetFolder || brandData.name)
          : '';

        for (const modelData of brandData.models) {
          const existingModel = await prisma.carModel.findFirst({
            where: {
              brandId: brand.id,
              name: modelData.name,
            },
          });

          let modelImagePath: string | undefined;

          if (useR2) {
            modelImagePath = normalizeR2Url(
              carAssetsBase,
              'models',
              brandData.assetFolder || brandData.name,
              modelData.image
            );
          } else if (localAssetsBasePath && modelData.image) {
            const modelImageMissing = existingModel?.imageUrl
              ? !fs.existsSync(path.join(process.cwd(), 'uploads', existingModel.imageUrl))
              : false;

            if (!existingModel?.imageUrl || modelImageMissing) {
              modelImagePath = copyImageToUploads(
                modelsAssetDir,
                modelData.image,
                'cars/models'
              );
            } else {
              modelImagePath = existingModel.imageUrl;
            }
          }

          if (!existingModel) {
            await prisma.carModel.create({
              data: {
                brandId: brand.id,
                name: modelData.name,
                imageUrl: modelImagePath || null,
              },
            });
            console.log(`  + Model: ${brandData.name} ${modelData.name}`);
          } else if (modelImagePath && existingModel.imageUrl !== modelImagePath) {
            await prisma.carModel.update({
              where: { id: existingModel.id },
              data: { imageUrl: modelImagePath },
            });
            console.log(`  ✓ Updated image for model: ${brandData.name} ${modelData.name} → ${modelImagePath}`);
          }
        }
      }
    }
  } else {
    console.warn(`cars.json not found at ${carsFilePath}. Skipping car seed.`);
  }

  // 4. Create Preset Car Statuses
  console.log('Seeding preset car statuses...');
  const carStatuses = [
    { id: "scratchLeftFrontDoor", code: "EXT_001" },
    { id: "scratchRightFrontDoor", code: "EXT_002" },
    { id: "scratchLeftRearDoor", code: "EXT_003" },
    { id: "scratchRightRearDoor", code: "EXT_004" },
    { id: "dentFrontBumper", code: "EXT_005" },
    { id: "dentRearBumper", code: "EXT_006" },
    { id: "dentLeftFender", code: "EXT_007" },
    { id: "dentRightFender", code: "EXT_008" },
    { id: "crackedWindshield", code: "EXT_009" },
    { id: "crackedRearGlass", code: "EXT_010" },
    { id: "chippedSideMirrorLeft", code: "EXT_011" },
    { id: "chippedSideMirrorRight", code: "EXT_012" },
    { id: "brokenAirVent", code: "ELEC_001" },
    { id: "powerSeatNotWorking", code: "ELEC_002" },
    { id: "seatHeaterNotWorking", code: "ELEC_003" },
    { id: "brokenReclineHandle", code: "ELEC_004" },
    { id: "seatBeltFrayingJammed", code: "ELEC_005" },
    { id: "windowSwitchLooseBroken", code: "ELEC_006" },
    { id: "trunkOpeningIssue", code: "ELEC_007" },
    { id: "frontLightsIssue", code: "ELEC_008" },
    { id: "rearLightsIssue", code: "ELEC_009" },
    { id: "interiorLightsIssue", code: "ELEC_010" },
    { id: "touchScreenIssues", code: "ELEC_011" }
    // rare light glass broken
  ];

  for (const status of carStatuses) {
    await prisma.carStatus.upsert({
      where: { code: status.code },
      update: { name: status.id }, // name is storing the id/translation key
      create: { name: status.id, code: status.code }
    });
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
