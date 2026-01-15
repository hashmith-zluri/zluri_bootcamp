const express = require('express');
const router = express.Router();
const dbController = require('../controllers/db.controller');
const auth = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { dbTypeSchema } = require('../validators/schemas');

// GET /api/db/types
router.get('/types', auth, dbController.getDbTypes);
// GET /api/db/instances?type=POSTGRES
router.get('/instances', auth, validate({ query: dbTypeSchema }), dbController.getDbInstances);
// GET /api/db/instances/:id/name
router.get('/instances/:id/name', auth, dbController.getDatabasesByInstance);

module.exports = router;
