const mongoose = require("mongoose")

const MeetingSchema = new mongoose.Schema({

 title:String,
 meetingLink:String,
 transcript:String,
 summary:String,
 date:Date,
 status:String

})

module.exports = mongoose.model("Meeting",MeetingSchema)