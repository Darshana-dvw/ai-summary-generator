const Admin = require("../models/Admin")
const bcrypt = require("bcryptjs")

exports.login = async(req,res)=>{

 const {email,password} = req.body

 const admin = await Admin.findOne({email})

 if(!admin)
  return res.send("Admin not found")

 const valid = await bcrypt.compare(password,admin.password)

 if(!valid)
  return res.send("Invalid password")

 res.send("Login success")

}