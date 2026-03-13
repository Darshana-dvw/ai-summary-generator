const Employee = require("../models/Employee")

exports.addEmployee = async(req,res)=>{

 const emp = new Employee(req.body)

 await emp.save()

 res.send("Employee added")

}

exports.getEmployees = async(req,res)=>{

 const employees = await Employee.find()

 res.json(employees)

}