const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendMail({ to, subject, text, html }) {
  await transporter.sendMail({
    from: `"MeetMind Bot" <${process.env.EMAIL_USER}>`,
    to,
    subject: subject || "Meeting Summary",
    text,
    html
  });
}

module.exports = sendMail;
