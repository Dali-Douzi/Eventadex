const router = require('express').Router();
const { requireMaster } = require('../middleware/auth');
const {
  listOrganizations,
  createOrganization,
  getOrganization,
  updateOrganization,
  resetOrgPassword,
  updateOrgPermissions,
  deleteOrganization,
  banishOrganization,
  listLookups,
  createLookup,
  updateLookup,
  deleteLookup,
  banishLookup,
  getStats,
  exportOrganizations,
  listVisitors,
  importVisitorsFromCSV,
  resetAndImportVisitors,
  clearVisitors,
} = require('../controllers/masterController');

// All routes in this router require master auth
router.use(requireMaster);

// ── Stats ────────────────────────────────────────────────
router.get('/stats', getStats);

// ── Organizations ─────────────────────────────────────────
router.get   ('/organizations',                    listOrganizations);
router.get   ('/organizations/export',             exportOrganizations);
router.post  ('/organizations',                    createOrganization);
router.get   ('/organizations/:id',                getOrganization);
router.patch ('/organizations/:id',                updateOrganization);
router.patch ('/organizations/:id/reset-password', resetOrgPassword);
router.patch ('/organizations/:id/permissions',    updateOrgPermissions);
router.delete('/organizations/:id',                deleteOrganization);
router.delete('/organizations/:id/banish',         banishOrganization);

// ── Global lookups  /api/master/lookups/:type ─────────────
router.get   ('/lookups/:type',              listLookups);
router.post  ('/lookups/:type',              createLookup);
router.patch ('/lookups/:type/:id',          updateLookup);
router.delete('/lookups/:type/:id',          deleteLookup);
router.delete('/lookups/:type/:id/banish',   banishLookup);

// ── Visitors ──────────────────────────────────────────────
router.get   ('/visitors',              listVisitors);
router.post  ('/visitors/import',       importVisitorsFromCSV);
router.post  ('/visitors/reset-import', resetAndImportVisitors);
router.delete('/visitors/clear',        clearVisitors);

module.exports = router;
