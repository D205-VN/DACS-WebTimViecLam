const meetingRoomService = require('../services/meeting-room.service');

const delegate = (handler) => (req, res, next) => handler(req, res, next);

module.exports = {
  ensureMeetingRoomSchemaForRequest: delegate(meetingRoomService.ensureMeetingRoomSchemaForRequest),
  getAllRooms: delegate(meetingRoomService.getAllRooms),
  getRoomByAccessToken: delegate(meetingRoomService.getRoomByAccessToken),
  confirmRoomAccess: delegate(meetingRoomService.confirmRoomAccess),
  updateRecordingStatus: delegate(meetingRoomService.updateRecordingStatus),
  markHostJoined: delegate(meetingRoomService.markHostJoined),
  completeCurrentInterview: delegate(meetingRoomService.completeCurrentInterview),
  saveHostInterviewEvaluation: delegate(meetingRoomService.saveHostInterviewEvaluation),
  createRoom: delegate(meetingRoomService.createRoom),
  updateRoom: delegate(meetingRoomService.updateRoom),
  deleteRoom: delegate(meetingRoomService.deleteRoom),
  bookMeeting: delegate(meetingRoomService.bookMeeting),
  getUserSchedules: delegate(meetingRoomService.getUserSchedules),
};
