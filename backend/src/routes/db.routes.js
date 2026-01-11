const express = require('express');
const router = express.Router();
const dbController = require('../controllers/db.controller');
const auth = require('../middlewares/auth.middleware');

// GET /api/db/types
router.get('/types', auth, dbController.getDbTypes);
// GET /api/db/instances?type=POSTGRES
router.get('/instances', auth, dbController.getDbInstances);
// GET /api/db/instances/:id/name
router.get('/instances/:id/name', auth, dbController.getDatabasesByInstance);

module.exports = router;
