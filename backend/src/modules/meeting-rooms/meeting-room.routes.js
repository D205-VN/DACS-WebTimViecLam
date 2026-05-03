const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../core/middlewares/auth.middleware');
const meetingController = require('./meeting-room.controller');

function requireEmployer(req, res, next) {
    if (req.user.role_code !== 'employer') {
        return res.status(403).json({ error: 'Chỉ nhà tuyển dụng mới có quyền truy cập phòng meeting' });
    }
    return next();
}

router.get('/access/:token', meetingController.ensureMeetingRoomSchemaForRequest, meetingController.getRoomByAccessToken);
router.patch('/access/:token/confirm', meetingController.ensureMeetingRoomSchemaForRequest, meetingController.confirmRoomAccess);
router.patch('/access/:token/host-start', meetingController.ensureMeetingRoomSchemaForRequest, meetingController.markHostJoined);
router.patch('/access/:token/recording', meetingController.ensureMeetingRoomSchemaForRequest, meetingController.updateRecordingStatus);
router.patch('/access/:token/complete', meetingController.ensureMeetingRoomSchemaForRequest, meetingController.completeCurrentInterview);

router.use(authenticateToken);
router.use(meetingController.ensureMeetingRoomSchemaForRequest);

// Lấy danh sách tất cả các phòng họp
router.get('/', requireEmployer, meetingController.getAllRooms);

// Tạo phòng họp mới
router.post('/', requireEmployer, meetingController.createRoom);

// Cập nhật phòng họp
router.put('/:id', requireEmployer, meetingController.updateRoom);

// Xóa phòng họp
router.delete('/:id', requireEmployer, meetingController.deleteRoom);

// Đặt lịch họp mới
router.post('/book', requireEmployer, meetingController.bookMeeting);

// Lấy lịch họp của một người dùng cụ thể
router.get('/my-schedules/:userId', meetingController.getUserSchedules);

module.exports = router;
