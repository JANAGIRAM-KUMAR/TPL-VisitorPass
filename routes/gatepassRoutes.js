const router = require("express").Router();
const auth = require("../middleware/authMiddleware");
const role = require("../middleware/roleMiddleware");
const upload = require("../middleware/upload");
const ctrl = require("../controllers/gatepass-controller");

/* USER */
router.post("/", auth, role("USER"), ctrl.createRequest);

/* ADMIN */
router.get("/pending", auth, role("ADMIN"), ctrl.getPending);
router.get("/approved", auth, role("ADMIN"), ctrl.getApproved);
// ADMIN / USER
router.get(
  "/reports",
  auth,
  role("ADMIN"),
  ctrl.getReportData
);
// SEARCH valid visitors (today)
router.get(
  "/search/valid",
  auth,
  role("ADMIN"),
  ctrl.searchValidVisitors
);

// DAILY ENTRY LOGS
router.post(
  "/mark-in",
  auth,
  role("ADMIN"),
  upload.single("photo"),
  ctrl.markIn
);

router.post(
  "/mark-out",
  auth,
  role("ADMIN"),
  ctrl.markOut
);

router.get(
  "/today/:id",
  auth,
  role("ADMIN"),
  ctrl.getTodayLog
);

router.get("/:id", auth, ctrl.getGatePassById);


router.put(
  "/:id/approve",
  auth,
  role("ADMIN"),
  upload.single("photo"),
  ctrl.approveRequest
);

module.exports = router;
