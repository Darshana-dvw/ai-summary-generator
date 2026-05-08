const Admin = require("../models/Admin");
const Employee = require("../models/Employee");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const generateToken = (user, role) => {
  return jwt.sign(
    { id: user._id, email: user.email, role },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );
};

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(404).json({ error: "Admin not found" });

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ error: "Invalid password" });

    const token = generateToken(admin, "admin");

    res.json({
      message: "Login success",
      token,
      user: { id: admin._id, email: admin.email, name: admin.name, role: "admin" }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.employeeLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const employee = await Employee.findOne({ email });
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const valid = await bcrypt.compare(password, employee.password);
    if (!valid) return res.status(401).json({ error: "Invalid password" });

    const token = generateToken(employee, "employee");

    res.json({
      message: "Login success",
      token,
      user: {
        id: employee._id,
        email: employee.email,
        name: employee.name,
        company: employee.company,
        team: employee.team,
        role: "employee"
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const { id, role } = req.user;

    if (role === "admin") {
      const admin = await Admin.findById(id).select("-password");
      return res.json({ ...admin.toObject(), role: "admin" });
    }

    const employee = await Employee.findById(id).select("-password");
    res.json({ ...employee.toObject(), role: "employee" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};