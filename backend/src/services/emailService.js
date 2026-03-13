const nodemailer = require("nodemailer")

const transporter = nodemailer.createTransport({

 service:"gmail",

 auth:{
  user:"your_email@gmail.com",
  pass:"app_password"
 }

})

async function sendMail(to,summary){

 await transporter.sendMail({

  from:"Meeting Bot",
  to,
  subject:"Meeting Summary",
  text:summary

 })

}

module.exports = sendMail