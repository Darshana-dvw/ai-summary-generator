const router = require("express").Router()
const meet = require("../controllers/meetingController")

router.post("/create",meet.createMeeting)
router.get("/all",meet.getMeetings)

module.exports = router