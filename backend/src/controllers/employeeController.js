const Employee = require("../models/Employee");
const Notification = require("../models/Notification");
const bcrypt = require("bcryptjs");
const { notifyEmployee } = require("../config/socket");

// Generate a random password
const generatePassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

exports.addEmployee = async (req, res) => {
  try {
    const { name, email, company, team } = req.body;

    const existing = await Employee.findOne({ email });
    if (existing) return res.status(400).json({ error: "Employee with this email already exists" });

    const rawPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const emp = new Employee({
      name,
      email,
      password: hashedPassword,
      company: company || "",
      team: team || ""
    });
    await emp.save();

    res.json({
      employee: { _id: emp._id, name: emp.name, email: emp.email, company: emp.company, team: emp.team, createdAt: emp.createdAt },
      tempPassword: rawPassword,
      message: `Employee added. Temporary password: ${rawPassword}`
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getEmployees = async (req, res) => {
  try {
    const employees = await Employee.find().select("-password").sort({ createdAt: -1 });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const emp = await Employee.findByIdAndDelete(req.params.id);
    if (!emp) return res.status(404).json({ error: "Employee not found" });

    // Also delete their notifications
    await Notification.deleteMany({ employee: req.params.id });

    res.json({ message: "Employee removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const { name, email, company, team } = req.body;
    const emp = await Employee.findByIdAndUpdate(
      req.params.id,
      { name, email, company, team },
      { new: true }
    ).select("-password");

    if (!emp) return res.status(404).json({ error: "Employee not found" });
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};