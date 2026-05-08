const express = require("express");
const router = express.Router();
const emp = require("../controllers/employeeController");
const authMiddleware = require("../config/authMiddleware");

router.post("/", authMiddleware(["admin"]), emp.addEmployee);
router.get("/", authMiddleware(["admin"]), emp.getEmployees);
router.put("/:id", authMiddleware(["admin"]), emp.updateEmployee);
router.delete("/:id", authMiddleware(["admin"]), emp.deleteEmployee);

module.exports = router;
