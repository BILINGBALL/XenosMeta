import { Router } from 'express'
import { asyncHandler } from '@utils/async-handler';
import { dynamicController } from '@modules/dynamic/controller/dynamic.controller';
import { authMiddleware } from '@middleware/auth';
import { hasPermission } from '@middleware/permission';
import { validate } from '@middleware/validate.middleware'
import { createFieldSchema, updateFieldSchema } from '@validators/field.validator'

const router = Router();
router.use(authMiddleware);

// 表管理
router.get('/tables', hasPermission('dynamic:table:view'), dynamicController.getTables);
router.post('/tables', hasPermission('dynamic:table:add'), dynamicController.createTable);
router.get('/tables/:tableId', hasPermission('dynamic:table:view'), dynamicController.getTable);
router.put('/tables/:tableId', hasPermission('dynamic:table:edit'), dynamicController.updateTable);
router.delete('/tables/:tableId', hasPermission('dynamic:table:delete'), dynamicController.deleteTable);
router.put('/tables/:tableId/restore', hasPermission('dynamic:table:edit'), dynamicController.restoreTable);

// 字段管理
router.get('/tables/:tableId/fields', hasPermission('dynamic:field:view'), dynamicController.getFields);
router.post('/tables/:tableId/fields', hasPermission('dynamic:field:add'), validate(createFieldSchema), dynamicController.createField);
router.get('/tables/:tableId/fields/:fieldId', hasPermission('dynamic:field:view'), dynamicController.getField);
router.put('/tables/:tableId/fields/:fieldId', hasPermission('dynamic:field:edit'), validate(updateFieldSchema), dynamicController.updateField);
router.delete('/tables/:tableId/fields/:fieldId', hasPermission('dynamic:field:delete'), dynamicController.deleteField);
router.put('/tables/:tableId/fields/:fieldId/restore', hasPermission('dynamic:field:edit'), dynamicController.restoreField);

// 记录管理（核心！）
router.post('/tables/:tableId/records/list', hasPermission('dynamic:record:view'), dynamicController.getRecords);
router.post('/tables/:tableId/records', hasPermission('dynamic:record:add'), dynamicController.createRecord);
router.get('/tables/:tableId/records/:recordId', hasPermission('dynamic:record:view'), dynamicController.getRecord);
router.put('/tables/:tableId/records/:recordId', hasPermission('dynamic:record:edit'), dynamicController.updateRecord);
router.delete('/tables/:tableId/records/:recordId', hasPermission('dynamic:record:delete'), dynamicController.deleteRecord);
router.put('/tables/:tableId/records/:recordId/restore', hasPermission('dynamic:record:edit'), dynamicController.restoreRecord);

// 字段引用
router.post('/tables/:tableId/references', hasPermission('dynamic:field:add'), dynamicController.createReference);
router.get('/tables/:tableId/references', hasPermission('dynamic:field:view'), dynamicController.getReferences);
router.get('/tables/:tableId/references/:refId', hasPermission('dynamic:field:view'), dynamicController.getReference);
router.put('/tables/:tableId/references/:refId', hasPermission('dynamic:field:edit'), dynamicController.updateReference);
router.delete('/tables/:tableId/references/:refId', hasPermission('dynamic:field:delete'), dynamicController.deleteReference);
router.post('/tables/:tableId/references/:refId/lookup', hasPermission('dynamic:record:view'), dynamicController.lookupRecords);

export default router;
