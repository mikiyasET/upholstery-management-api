import { PrismaClient, Unit, StoreType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const catalogData = {
    "materials": [
        { "name": "Spokiyo / Side Mirror Protection Kit", "nameAm": "ስፖኪዮ መከላከያ", "price": 1000 },
        { "name": "Charger Cover", "nameAm": "ቻርጀር ክዳን", "price": 1000 },
        { "name": "Floor Mat", "nameAm": "ወለል ንጣፍ እና መረጋገጫ", "price": 1000 },
        { "name": "Tire Locker", "nameAm": "ጎማ መቆለፊያ", "price": 1000 },
        { "name": "Key Cover", "nameAm": "ቁልፍ መያዣ", "price": 1000 },
        { "name": "Alarm System Kit", "nameAm": "አላርም", "price": 1000 },
        { "name": "Key Blank", "nameAm": "ባዶ ቁልፍ", "price": 500 },
        { "name": "Mud Flaps / Mud Protection", "nameAm": "የጭቃ መከላከያ", "price": 1000 },
        { "name": "Trunk Mat", "nameAm": "የኋላ ንጣፍ", "price": 1000 },
        { "name": "G.P.S Device", "nameAm": "ጂ.ፒ.ኤስ", "price": 1000 },
        { "name": "Plate Frame", "nameAm": "ታርጋ ፍሬም", "price": 1000 },
        { "name": "Wind Shed / Visor", "nameAm": "ንፋስ መከላከያ", "price": 1000 },
        { "name": "Polish Car Shampoo & Oil Polish", "nameAm": "ሻምፖ + ዳሽቦርድ ቅባት", "price": 1000 },
        { "name": "Shamoiz / Chamois Leather Cloth", "nameAm": "የውሻ ቆዳ", "price": 1000 },
        { "name": "Fire Extinguisher & First Aid Kit", "nameAm": "እሳት ማጥፊያ + ፈርስት ኤድ", "price": 1000 },
        { "name": "Cric & Lug Wrench", "nameAm": "ክሪክ + ጎማ መፍቻ", "price": 1000 },
        { "name": "Scort Tayer / Spare Tire", "nameAm": "ስኮርት ጎማ", "price": 1000 },
        { "name": "Infotainment Head Unit", "nameAm": "ፕሮግራሚንግ ስክሪን", "price": 1000 },
        { "name": "Steering Wheel Cover", "nameAm": "መሪ ልባስ", "price": 1000 },
        { "name": "Arm Rest Unit", "nameAm": "መደገፊያ", "price": 1000 },
        { "name": "Compressor", "nameAm": "ኮምፕረሰር", "price": 1000 },
        { "name": "GYM Bag", "nameAm": "ጂም ባግ", "price": 1000 },
        { "name": "Window Tint Film", "nameAm": "ስቲከር", "price": 1000 },
        { "name": "Molding / Protection Trim", "nameAm": "ሞልዲንግ", "price": 1000 },
        { "name": "Upholstery Leather / Fabric", "nameAm": "የታፕሴሪ ቆዳ / ጨርቅ", "price": 1000 },
        { "name": "Upholstery Foam & Padding", "nameAm": "ስፖንጅ እና ፓዲንግ", "price": 500 },
        { "name": "Adhesive / Spray Glue", "nameAm": "ማጣበቂያ / ሙጫ", "price": 300 },
        { "name": "PPF / Paint & Glass Protection Film", "nameAm": "የመኪና/የመስታወት PPF መከላከያ", "price": 1000 },
        { "name": "Thread & Sewing Accessories", "nameAm": "ክር እና ስፌት ዕቃዎች", "price": 200 }
    ],
    "services": [
        { "name": "Side Mirror Protection & Charger Cover Installation", "nameAm": "ስፖኪዮ እና ቻርጀር ክዳን ገጠማ", "price": 1000, "materialsUsed": ["Spokiyo / Side Mirror Protection Kit", "Charger Cover"] },
        { "name": "Cornice / Headliner Upholstery", "nameAm": "ኮርኒስ ሥራ", "price": 1000, "materialsUsed": ["Upholstery Leather / Fabric", "Upholstery Foam & Padding", "Adhesive / Spray Glue"] },
        { "name": "Door Panel Reupholstering", "nameAm": "የበር የታፕሴሪ ሥራ", "price": 1000, "materialsUsed": ["Upholstery Leather / Fabric", "Adhesive / Spray Glue"] },
        { "name": "Alarm System Installation", "nameAm": "አላርም ገጠማ", "price": 1000, "materialsUsed": ["Alarm System Kit"] },
        { "name": "Key Duplicate / Key Programming", "nameAm": "ቁልፍ ፕሮግራሚንግ / ኮፒ", "price": 1000, "materialsUsed": ["Key Blank"] },
        { "name": "Mud Protection Flaps Installation", "nameAm": "የጭቃ መከላከያ ገጠማ", "price": 1000, "materialsUsed": ["Mud Flaps / Mud Protection"] },
        { "name": "Seat Cover Tailoring & Fitting (Sit Cover)", "nameAm": "ወንበር ልባስ ስፌት እና ገጠማ", "price": 1000, "materialsUsed": ["Upholstery Leather / Fabric", "Upholstery Foam & Padding", "Thread & Sewing Accessories"] },
        { "name": "Infotainment System Setup & Programming", "nameAm": "ፕሮግራሚንግ (Infotainment)", "price": 1000, "materialsUsed": ["Infotainment Head Unit"] },
        { "name": "Steering Wheel Stitches & Cover Fitting", "nameAm": "መሪ ልባስ ስፌት/ገጠማ", "price": 1000, "materialsUsed": ["Steering Wheel Cover", "Thread & Sewing Accessories"] },
        { "name": "Arm Rest Upholstering & Fitting", "nameAm": "መደገፊያ ሥራ", "price": 1000, "materialsUsed": ["Arm Rest Unit", "Upholstery Leather / Fabric"] },
        { "name": "Sand Protection Film Installation", "nameAm": "ጠርጥር መከላከያ ገጠማ", "price": 1000, "materialsUsed": ["PPF / Paint & Glass Protection Film"] },
        { "name": "Battery Health Check Up", "nameAm": "ባትሪ ፍተሻ", "price": 1000, "materialsUsed": [] },
        { "name": "Car Inspection", "nameAm": "መኪና ፍተሻ", "price": 1000, "materialsUsed": [] },
        { "name": "Glass Protection Film Installation", "nameAm": "ግላስ ፕሮቴክሽን ገጠማ", "price": 1000, "materialsUsed": ["PPF / Paint & Glass Protection Film"] },
        { "name": "Tint Sticker Application", "nameAm": "ስቲከር (Tint) ማላቀቅ/መግጠም", "price": 1000, "materialsUsed": ["Window Tint Film"] },
        { "name": "Protection Molding Fitting", "nameAm": "ሞልዲንግ ገጠማ", "price": 1000, "materialsUsed": ["Molding / Protection Trim"] },
        { "name": "Full Set Interior Upholstery", "nameAm": "ፋልሴት የታፕሴሪ ሥራ", "price": 1000, "materialsUsed": ["Upholstery Leather / Fabric", "Upholstery Foam & Padding", "Adhesive / Spray Glue", "Thread & Sewing Accessories"] }
    ]
  };

  console.log('Seeding materials...');
  const materialMap = new Map();

  // Ensure main store exists
  const mainStore = await prisma.store.upsert({
    where: { type: StoreType.MAIN },
    update: {},
    create: { name: 'Main Store', type: StoreType.MAIN }
  });

  for (const mat of catalogData.materials) {
    // Check if it already exists to avoid duplicates
    let createdMat = await prisma.material.findFirst({
      where: { nameEn: mat.name }
    });

    if (!createdMat) {
      createdMat = await prisma.material.create({
        data: {
          nameEn: mat.name,
          nameAm: mat.nameAm,
          unit: Unit.PCS,
          isBulkTracked: false,
          isStandaloneSellable: true,
          lowStockThreshold: 10,
          currentPrice: mat.price,
        }
      });
      console.log(`Created material: ${mat.name}`);
      
      await prisma.materialStock.create({
        data: {
          materialId: createdMat.id,
          storeId: mainStore.id,
          quantity: 100,
        }
      });
    } else {
      console.log(`Material already exists: ${mat.name}`);
    }
    
    // Add to map for later use
    materialMap.set(mat.name, createdMat.id);
  }

  console.log('\nSeeding services...');
  
  // Default Service Group
  let defaultGroup = await prisma.serviceGroup.findFirst({
    where: { nameEn: 'General Services' }
  });

  if (!defaultGroup) {
    defaultGroup = await prisma.serviceGroup.create({
      data: {
        nameEn: 'General Services',
        nameAm: 'አጠቃላይ አገልግሎቶች',
      }
    });
  }

  for (const svc of catalogData.services) {
    let createdSvc = await prisma.service.findFirst({
      where: { nameEn: svc.name }
    });

    if (!createdSvc) {
      createdSvc = await prisma.service.create({
        data: {
          nameEn: svc.name,
          nameAm: svc.nameAm,
          serviceGroupId: defaultGroup.id,
        }
      });
      console.log(`Created service: ${svc.name}`);
    } else {
      console.log(`Service already exists: ${svc.name}`);
    }

    // Check default category
    let defaultCat = await prisma.serviceCategory.findFirst({
      where: { serviceId: createdSvc.id, nameEn: 'Standard' }
    });

    if (!defaultCat) {
      defaultCat = await prisma.serviceCategory.create({
        data: {
          serviceId: createdSvc.id,
          nameEn: 'Standard',
          nameAm: 'መደበኛ',
          price: svc.price,
        }
      });
    }

    // Link materials
    if (svc.materialsUsed && Array.isArray(svc.materialsUsed)) {
      for (const matName of svc.materialsUsed) {
        const matId = materialMap.get(matName);
        if (matId) {
          const existingUsage = await prisma.serviceCategoryMaterialUsage.findUnique({
            where: {
              serviceCategoryId_materialId: {
                serviceCategoryId: defaultCat.id,
                materialId: matId,
              }
            }
          });

          if (!existingUsage) {
            await prisma.serviceCategoryMaterialUsage.create({
              data: {
                serviceCategoryId: defaultCat.id,
                materialId: matId,
                quantityUsed: 1, // Defaulting to 1
              }
            });
            console.log(`  - Linked material: ${matName}`);
          }
        } else {
          console.warn(`  - Warning: Material not found for linking: ${matName}`);
        }
      }
    }
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
