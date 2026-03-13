const Meeting = require("../models/Meeting")

exports.createMeeting = async(req,res)=>{

 const meeting = new Meeting(req.body)

 await meeting.save()

 res.send("Meeting created")

}

exports.getMeetings = async(req,res)=>{

 const meetings = await Meeting.find()

 res.json(meetings)

}