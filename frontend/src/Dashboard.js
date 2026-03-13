import React, { useState, useEffect } from "react";
import axios from "axios";

function Dashboard() {
  const [employees, setEmployees] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Fetch employees
  useEffect(() => {
    axios.get("http://localhost:5000/api/employees").then((res) => {
      setEmployees(res.data);
    });
  }, []);

  // Add employee
  const addEmployee = async () => {
    const res = await axios.post("http://localhost:5000/api/employees", {
      name,
      email,
    });
    setEmployees([...employees, res.data]);
    setName("");
    setEmail("");
  };

  // Send summary email
  const sendSummary = async (empEmail) => {
    await axios.post("http://localhost:5000/api/email/send", {
      to: empEmail,
      subject: "Meeting Summary",
      text: "Here is the AI-generated summary of the meeting...",
    });
    alert("Summary sent to " + empEmail);
  };

  return (
    <div>
      <h2>Admin Dashboard</h2>
      <div>
        <input
          type="text"
          placeholder="Employee Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="email"
          placeholder="Employee Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button onClick={addEmployee}>Add Employee</button>
      </div>

      <h3>Employees</h3>
      <ul>
        {employees.map((emp) => (
          <li key={emp._id}>
            {emp.name} ({emp.email})
            <button onClick={() => sendSummary(emp.email)}>Send Summary</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Dashboard;
