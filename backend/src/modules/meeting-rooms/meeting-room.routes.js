const express = require('express');
const router = express.Router();
const meetingController = require('./meeting-room.controller');

// Lấy danh sách tất cả các phòng họp
router.get('/', meetingController.getAllRooms);

// Tạo phòng họp mới
router.post('/', meetingController.createRoom);

// Cập nhật phòng họp
router.put('/:id', meetingController.updateRoom);

// Xóa phòng họp
router.delete('/:id', meetingController.deleteRoom);

// Đặt lịch họp mới
router.post('/book', meetingController.bookMeeting);

// Lấy lịch họp của một người dùng cụ thể
router.get('/my-schedules/:userId', meetingController.getUserSchedules);

module.exports = router;
