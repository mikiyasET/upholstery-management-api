import { PrismaClient, UserRole, StoreType, Unit } from '@prisma/client';
import * as argon2 from 'argon2';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

/**
 * Copies an image from Cars-Asset to the uploads directory with a UUID filename.
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


  // 3. Create Car Catalog from cars.json with images
  console.log('Seeding car catalog from cars.json...');
  const carsFilePath = fs.existsSync(path.join(process.cwd(), 'cars.json'))
    ? path.join(process.cwd(), 'cars.json')
    : path.join(process.cwd(), '../cars.json');
  const assetsBasePath = fs.existsSync(path.join(process.cwd(), 'Cars-Asset'))
    ? path.join(process.cwd(), 'Cars-Asset')
    : path.join(process.cwd(), '../Cars-Asset');

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

      let brandLogoPath = brand?.logoUrl || undefined;
      const brandLogoMissing = brand?.logoUrl ? !fs.existsSync(path.join(process.cwd(), 'uploads', brand.logoUrl)) : false;
      if ((!brandLogoPath || brandLogoMissing) && brandData.logo) {
        brandLogoPath = copyImageToUploads(
          path.join(assetsBasePath, 'brands'),
          brandData.logo,
          'cars/brands'
        );
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
        console.log(`Updated brand logo: ${brandData.name}`);
      }

      if (brandData.models && Array.isArray(brandData.models)) {
        const modelsAssetDir = path.join(assetsBasePath, 'models', brandData.assetFolder || brandData.name);

        for (const modelData of brandData.models) {
          const existingModel = await prisma.carModel.findFirst({
            where: {
              brandId: brand.id,
              name: modelData.name,
            },
          });

          const modelImageMissing = existingModel?.imageUrl ? !fs.existsSync(path.join(process.cwd(), 'uploads', existingModel.imageUrl)) : false;

          if (!existingModel) {
            let modelImagePath: string | undefined;
            if (modelData.image) {
              modelImagePath = copyImageToUploads(
                modelsAssetDir,
                modelData.image,
                'cars/models'
              );
            }

            await prisma.carModel.create({
              data: {
                brandId: brand.id,
                name: modelData.name,
                imageUrl: modelImagePath || null,
              },
            });
            console.log(`  + Model: ${brandData.name} ${modelData.name}`);
          } else if (modelData.image && (!existingModel.imageUrl || modelImageMissing)) {
            const modelImagePath = copyImageToUploads(
              modelsAssetDir,
              modelData.image,
              'cars/models'
            );
            if (modelImagePath) {
              await prisma.carModel.update({
                where: { id: existingModel.id },
                data: { imageUrl: modelImagePath },
              });
              console.log(`  ✓ Updated image for model: ${brandData.name} ${modelData.name}`);
            }
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
