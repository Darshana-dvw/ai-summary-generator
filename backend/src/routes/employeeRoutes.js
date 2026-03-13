const express = require("express");
const router = express.Router();
const Employee = require("../models/Employee");

// Add employee
router.post("/", async (req, res) => {
  try {
    const { name, email } = req.body;
    const employee = new Employee({ name, email });
    await employee.save();
    res.json(employee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all employees
router.get("/", async (req, res) => {
  const employees = await Employee.find();
  res.json(employees);
});

module.exports = router;
