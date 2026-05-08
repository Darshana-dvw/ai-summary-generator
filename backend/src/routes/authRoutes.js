const router = require("express").Router();
const { adminLogin, employeeLogin, getMe } = require("../controllers/authController");
const authMiddleware = require("../config/authMiddleware");

router.post("/admin/login", adminLogin);
router.post("/employee/login", employeeLogin);
router.get("/me", authMiddleware(), getMe);

module.exports = router;