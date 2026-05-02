const pool = require('../../infrastructure/database/postgres');

// 1. Lấy danh sách phòng
exports.getAllRooms = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM meeting_rooms ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 2. Tạo phòng họp mới
exports.createRoom = async (req, res) => {
    try {
        const { name, location, capacity, description } = req.body;
        const result = await pool.query(
            'INSERT INTO meeting_rooms (name, location, capacity, description) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, location, capacity, description]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// 3. Cập nhật phòng họp
exports.updateRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, location, capacity, description } = req.body;
        const result = await pool.query(
            'UPDATE meeting_rooms SET name = $1, location = $2, capacity = $3, description = $4 WHERE id = $5 RETURNING *',
            [name, location, capacity, description, id]
        );
        if (result.rowCount === 0) return res.status(404).json({ message: 'Room not found' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// 4. Xóa phòng họp
exports.deleteRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM meeting_rooms WHERE id = $1 RETURNING *', [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Room not found' });
        res.json({ message: 'Room deleted' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// 5. Đặt lịch họp và kiểm tra trùng
exports.bookMeeting = async (req, res) => {
    const { roomId, employerId, seekerId, startTime, endTime, title } = req.body;
    try {
        const conflictResult = await pool.query(
            `SELECT * FROM meeting_schedules
             WHERE meeting_room_id = $1
             AND start_time < $2
             AND end_time > $3`,
            [roomId, endTime, startTime]
        );

        if (conflictResult.rowCount > 0) {
            return res.status(400).json({ message: 'Phòng đã có người đặt trong khung giờ này!' });
        }

        const result = await pool.query(
            `INSERT INTO meeting_schedules (meeting_room_id, employer_id, seeker_id, start_time, end_time, title)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [roomId, employerId, seekerId, startTime, endTime, title]
        );

        res.status(201).json({ message: 'Đặt phòng thành công!', data: result.rows[0] });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 6. Lấy lịch họp theo user
exports.getUserSchedules = async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await pool.query(
            `SELECT ms.*, mr.name AS room_name, mr.location
             FROM meeting_schedules ms
             JOIN meeting_rooms mr ON mr.id = ms.meeting_room_id
             WHERE ms.employer_id = $1 OR ms.seeker_id = $1
             ORDER BY ms.start_time DESC`,
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
