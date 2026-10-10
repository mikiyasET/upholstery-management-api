import { Router } from 'express';
import { CatalogController } from './catalog.controller';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { upload } from '../../lib/uploads';
import { requirePermission } from '../../middleware/permissions';
import * as schemas from './catalog.schemas';

const router = Router();

// All catalog routes require authentication
router.use(requireAuth);

// ---------------------------------
// Materials
// ---------------------------------
router.get('/materials', requirePermission('catalog.materials.view'), CatalogController.getMaterials);
router.get('/materials/:id', requirePermission('catalog.materials.view'), CatalogController.getMaterial);
router.post(
  '/materials',
  requirePermission('catalog.materials.add'),
  upload.single('image'),
  validate(schemas.materialSchema),
  CatalogController.createMaterial
);
router.patch('/materials/:id', requirePermission('catalog.materials.edit'), upload.single('image'), validate(schemas.materialSchema), CatalogController.updateMaterial);
router.delete('/materials/:id', requirePermission('catalog.materials.remove'), CatalogController.deleteMaterial);

// ---------------------------------
// Services & Groups
// ---------------------------------
router.get('/service-groups', requirePermission('catalog.services.view'), CatalogController.getServiceGroups);
router.post('/service-groups', requirePermission('catalog.services.add'), validate(schemas.serviceGroupSchema), CatalogController.createServiceGroup);

router.get('/services', requirePermission('catalog.services.view'), CatalogController.getServices);
router.post('/services', requirePermission('catalog.services.add'), upload.single('image'), validate(schemas.serviceSchema), CatalogController.createService);
router.patch('/services/:id', requirePermission('catalog.services.edit'), upload.single('image'), validate(schemas.serviceSchema), CatalogController.updateService);
router.delete('/services/:id', requirePermission('catalog.services.remove'), CatalogController.deleteService);

router.get('/services/:serviceId/categories', requirePermission('catalog.services.view'), CatalogController.getServiceCategories);
router.post('/services/:serviceId/categories', requirePermission('catalog.services.add'), validate(schemas.createServiceCategorySchema), CatalogController.createServiceCategory);
router.patch('/services/:serviceId/categories/:id', requirePermission('catalog.services.edit'), validate(schemas.updateServiceCategorySchema), CatalogController.updateServiceCategory);
router.delete('/services/:serviceId/categories/:id', requirePermission('catalog.services.remove'), CatalogController.deleteServiceCategory);
router.get('/service-categories', requirePermission('catalog.services.view'), CatalogController.getAllServiceCategories);
router.post('/service-categories', requirePermission('catalog.services.add'), validate(schemas.serviceCategorySchema), CatalogController.createServiceCategoryOld);

router.post('/service-categories/usages', requirePermission('catalog.services.edit'), validate(schemas.serviceCategoryMaterialUsageSchema), CatalogController.setCategoryMaterialUsage);
router.delete('/service-categories/usages/:id', requirePermission('catalog.services.remove'), CatalogController.deleteCategoryMaterialUsage);

// ---------------------------------
// Cars
// ---------------------------------
router.get('/car-brands', requirePermission('catalog.cars.view'), CatalogController.getCarBrands);
router.post('/car-brands', requirePermission('catalog.cars.add'), upload.single('image'), validate(schemas.carBrandSchema), CatalogController.createCarBrand);
router.patch('/car-brands/:id', requirePermission('catalog.cars.edit'), upload.single('image'), validate(schemas.updateCarBrandSchema), CatalogController.updateCarBrand);
router.delete('/car-brands/:id', requirePermission('catalog.cars.remove'), CatalogController.deleteCarBrand);

router.get('/car-models', requirePermission('catalog.cars.view'), CatalogController.getAllCarModels);
router.get('/car-brands/:brandId/models', requirePermission('catalog.cars.view'), CatalogController.getCarModels);
router.post('/car-models', requirePermission('catalog.cars.add'), upload.single('image'), validate(schemas.carModelSchema), CatalogController.createCarModel);
router.patch('/car-models/:id', requirePermission('catalog.cars.edit'), upload.single('image'), validate(schemas.updateCarModelSchema), CatalogController.updateCarModel);
router.delete('/car-models/:id', requirePermission('catalog.cars.remove'), CatalogController.deleteCarModel);

router.get('/car-statuses', requirePermission('catalog.cars.view'), CatalogController.getCarStatuses);
router.post('/car-statuses', requirePermission('catalog.cars.add'), validate(schemas.carStatusSchema), CatalogController.createCarStatus);

export default router;
