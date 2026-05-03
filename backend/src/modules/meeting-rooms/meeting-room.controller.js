const pool = require('../../infrastructure/database/postgres');
const { ensureMeetingRoomSchema } = require('./meeting-room.model');

const ACTIVE_QUEUE_STATUSES = ['waiting', 'in_interview'];

exports.ensureMeetingRoomSchemaForRequest = async (req, res, next) => {
    try {
        await ensureMeetingRoomSchema();
        return next();
    } catch (error) {
        console.error('Ensure meeting room schema error:', error);
        return res.status(500).json({ error: 'Lỗi cấu hình dữ liệu phòng meeting' });
    }
};

function normalizeRoomPayload(body = {}) {
    const capacity = Number.parseInt(body.capacity, 10);

    return {
        name: String(body.name || '').trim(),
        location: String(body.location || '').trim(),
        capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : 2,
        description: String(body.description || '').trim(),
        meeting_link: String(body.meeting_link || '').trim() || null,
    };
}

function deriveRoomQueueStatus(room, candidates = []) {
    if (candidates.some((candidate) => candidate.queue_status === 'in_interview')) return 'in_interview';
    if (candidates.some((candidate) => candidate.queue_status === 'waiting')) return 'waiting';
    if (candidates.length && candidates.every((candidate) => candidate.queue_status === 'completed' || candidate.ended_at)) return 'completed';
    return room.queue_status || 'invited';
}

function getCurrentCandidate(candidates = []) {
    return candidates.find((candidate) => candidate.queue_status === 'in_interview')
        || candidates.find((candidate) => candidate.queue_status === 'waiting')
        || candidates[0]
        || null;
}

async function getCandidateQueuePosition(client, scheduleId) {
    const result = await client.query(
        `SELECT ranked.position
         FROM (
           SELECT id,
                  ROW_NUMBER() OVER (
                    PARTITION BY meeting_room_id
                    ORDER BY checked_in_at ASC NULLS LAST, id ASC
                  )::int AS position
           FROM meeting_schedules
           WHERE checked_in_at IS NOT NULL
             AND ended_at IS NULL
             AND COALESCE(queue_status, 'invited') = ANY($2::text[])
             AND meeting_room_id = (
               SELECT meeting_room_id FROM meeting_schedules WHERE id = $1
             )
         ) ranked
         WHERE ranked.id = $1`,
        [scheduleId, ACTIVE_QUEUE_STATUSES]
    );

    return result.rows[0]?.position || null;
}

async function getLegacyRoomQueuePosition(client, roomId) {
    const result = await client.query(
        `SELECT ranked.position
         FROM (
           SELECT id,
                  ROW_NUMBER() OVER (
                    PARTITION BY employer_id, job_id, interview_date
                    ORDER BY checked_in_at ASC NULLS LAST, id ASC
                  )::int AS position
           FROM meeting_rooms
           WHERE checked_in_at IS NOT NULL
             AND ended_at IS NULL
             AND COALESCE(queue_status, 'invited') = ANY($2::text[])
             AND employer_id = (SELECT employer_id FROM meeting_rooms WHERE id = $1)
             AND job_id = (SELECT job_id FROM meeting_rooms WHERE id = $1)
             AND interview_date = (SELECT interview_date FROM meeting_rooms WHERE id = $1)
         ) ranked
         WHERE ranked.id = $1`,
        [roomId, ACTIVE_QUEUE_STATUSES]
    );

    return result.rows[0]?.position || null;
}

async function getRoomCandidates(client, roomId) {
    const result = await client.query(
        `SELECT
            ms.id AS schedule_id,
            ms.application_id,
            ms.seeker_id,
            ms.start_time,
            ms.end_time,
            ms.title,
            ms.queue_status,
            ms.confirmed_at,
            ms.checked_in_at,
            ms.admitted_at,
            ms.started_at,
            ms.ended_at,
            u.full_name AS candidate_name,
            u.email AS candidate_email,
            aj.interview_at,
            aj.interview_mode,
            CASE
              WHEN ms.checked_in_at IS NULL OR ms.ended_at IS NOT NULL THEN NULL
              ELSE (
                SELECT COUNT(*)::int
                FROM meeting_schedules q
                WHERE q.meeting_room_id = ms.meeting_room_id
                  AND q.checked_in_at IS NOT NULL
                  AND q.ended_at IS NULL
                  AND COALESCE(q.queue_status, 'invited') = ANY($2::text[])
                  AND (
                    q.checked_in_at < ms.checked_in_at
                    OR (q.checked_in_at = ms.checked_in_at AND q.id <= ms.id)
                  )
              )
            END AS queue_position
         FROM meeting_schedules ms
         LEFT JOIN applied_jobs aj ON aj.id = ms.application_id
         LEFT JOIN users u ON u.id = COALESCE(ms.seeker_id, aj.user_id)
         WHERE ms.meeting_room_id = $1
         ORDER BY
           CASE COALESCE(ms.queue_status, 'invited')
             WHEN 'in_interview' THEN 0
             WHEN 'waiting' THEN 1
             WHEN 'invited' THEN 2
             WHEN 'completed' THEN 3
             ELSE 4
           END,
           ms.checked_in_at ASC NULLS LAST,
           ms.start_time ASC NULLS LAST,
           ms.id ASC`,
        [roomId, ACTIVE_QUEUE_STATUSES]
    );

    return result.rows;
}

async function admitFirstWaitingCandidate(client, roomId) {
    const active = await client.query(
        `SELECT id
         FROM meeting_schedules
         WHERE meeting_room_id = $1
           AND ended_at IS NULL
           AND queue_status = 'in_interview'
         ORDER BY admitted_at ASC NULLS LAST, id ASC
         LIMIT 1`,
        [roomId]
    );

    if (active.rows.length) return active.rows[0];

    const next = await client.query(
        `UPDATE meeting_schedules
         SET queue_status = 'in_interview',
             admitted_at = COALESCE(admitted_at, NOW()),
             started_at = COALESCE(started_at, NOW()),
             updated_at = NOW()
         WHERE id = (
           SELECT id
           FROM meeting_schedules
           WHERE meeting_room_id = $1
             AND checked_in_at IS NOT NULL
             AND ended_at IS NULL
             AND COALESCE(queue_status, 'invited') = 'waiting'
           ORDER BY checked_in_at ASC, id ASC
           LIMIT 1
         )
         RETURNING id`,
        [roomId]
    );

    return next.rows[0] || null;
}

async function admitFirstWaitingRoom(client, { employerId, jobId, interviewDate }) {
    const active = await client.query(
        `SELECT id
         FROM meeting_rooms
         WHERE employer_id = $1
           AND job_id = $2
           AND interview_date = $3
           AND ended_at IS NULL
           AND queue_status = 'in_interview'
         ORDER BY admitted_at ASC NULLS LAST, id ASC
         LIMIT 1`,
        [employerId, jobId, interviewDate]
    );

    if (active.rows.length) return active.rows[0];

    const next = await client.query(
        `UPDATE meeting_rooms
         SET queue_status = 'in_interview',
             admitted_at = COALESCE(admitted_at, NOW()),
             started_at = COALESCE(started_at, NOW()),
             updated_at = NOW()
         WHERE id = (
           SELECT id
           FROM meeting_rooms
           WHERE employer_id = $1
             AND job_id = $2
             AND interview_date = $3
             AND checked_in_at IS NOT NULL
             AND ended_at IS NULL
             AND COALESCE(queue_status, 'invited') = 'waiting'
           ORDER BY checked_in_at ASC, id ASC
           LIMIT 1
         )
         RETURNING id`,
        [employerId, jobId, interviewDate]
    );

    return next.rows[0] || null;
}

// 1. Lấy danh sách phòng
exports.getAllRooms = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                mr.*,
                COALESCE(j.job_title, app_job.job_title) AS room_job_title,
                COALESCE(j.company_name, app_job.company_name) AS company_name,
                COUNT(ms.id)::int AS schedule_count,
                COUNT(DISTINCT ms.application_id)::int AS candidate_count,
                COUNT(ms.id) FILTER (WHERE ms.queue_status = 'waiting')::int AS waiting_count,
                COUNT(ms.id) FILTER (WHERE ms.queue_status = 'in_interview')::int AS active_count,
                COUNT(ms.id) FILTER (WHERE ms.queue_status = 'completed' OR ms.ended_at IS NOT NULL)::int AS completed_count,
                MIN(ms.start_time) AS first_schedule_time
             FROM meeting_rooms mr
             LEFT JOIN jobs j ON j.id = mr.job_id
             LEFT JOIN applied_jobs aj ON aj.id = mr.application_id
             LEFT JOIN jobs app_job ON app_job.id = aj.job_id
             LEFT JOIN meeting_schedules ms ON ms.meeting_room_id = mr.id
             WHERE (mr.employer_id = $1 OR mr.employer_id IS NULL)
             GROUP BY mr.id, j.job_title, app_job.job_title, j.company_name, app_job.company_name
             ORDER BY COALESCE(MIN(ms.start_time), mr.start_time, mr.created_at) DESC, mr.id DESC`,
            [req.user.id]
        );

        const rooms = await Promise.all(result.rows.map(async (room) => {
            const candidates = await getRoomCandidates(pool, room.id);
            const currentCandidate = getCurrentCandidate(candidates);
            return {
                ...room,
                queue_status: deriveRoomQueueStatus(room, candidates),
                candidates,
                candidate_name: currentCandidate?.candidate_name || null,
                candidate_email: currentCandidate?.candidate_email || null,
                interview_at: currentCandidate?.interview_at || room.first_schedule_time || room.start_time,
            };
        }));

        res.json({ data: rooms });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getRoomByAccessToken = async (req, res) => {
    try {
        const { token } = req.params;
        const hostResult = await pool.query(
            `SELECT
                mr.id, mr.name, mr.location, mr.description, mr.meeting_link,
                mr.jitsi_room_id, mr.recording_status, mr.recording_url,
                mr.queue_status, mr.host_joined_at, mr.start_time, mr.end_time,
                mr.host_token,
                j.job_title,
                j.company_name
             FROM meeting_rooms mr
             LEFT JOIN jobs j ON j.id = mr.job_id
             WHERE mr.host_token = $1
             LIMIT 1`,
            [token]
        );

        if (hostResult.rows.length) {
            const room = hostResult.rows[0];
            const candidates = await getRoomCandidates(pool, room.id);
            const currentCandidate = getCurrentCandidate(candidates);
            room.role = 'host';
            room.candidates = candidates;
            room.current_candidate = currentCandidate;
            room.application_id = currentCandidate?.application_id || null;
            room.candidate_name = currentCandidate?.candidate_name || null;
            room.interview_at = currentCandidate?.interview_at || room.start_time;
            room.queue_status = deriveRoomQueueStatus(room, candidates);
            room.can_join = true;
            room.daily_token = room.host_token;
            delete room.host_token;

            return res.json({ data: { role: 'host', room } });
        }

        const scheduleResult = await pool.query(
            `SELECT
                mr.id, mr.name, mr.location, mr.description, mr.meeting_link,
                mr.jitsi_room_id, mr.recording_status, mr.recording_url,
                mr.host_joined_at, mr.start_time, mr.end_time,
                ms.id AS schedule_id,
                ms.application_id,
                ms.queue_status,
                ms.confirmed_at,
                ms.checked_in_at,
                ms.admitted_at,
                ms.started_at,
                ms.ended_at,
                aj.interview_at,
                aj.interview_mode,
                u.full_name AS candidate_name,
                j.job_title,
                j.company_name
             FROM meeting_schedules ms
             JOIN meeting_rooms mr ON mr.id = ms.meeting_room_id
             LEFT JOIN applied_jobs aj ON aj.id = ms.application_id
             LEFT JOIN users u ON u.id = COALESCE(ms.seeker_id, aj.user_id)
             LEFT JOIN jobs j ON j.id = COALESCE(mr.job_id, aj.job_id)
             WHERE ms.access_token = $1
             LIMIT 1`,
            [token]
        );

        if (scheduleResult.rows.length) {
            const room = scheduleResult.rows[0];
            const queuePosition = await getCandidateQueuePosition(pool, room.schedule_id);
            room.queue_position = queuePosition;
            room.can_join = Boolean(room.host_joined_at) && room.queue_status === 'in_interview';
            return res.json({ data: { role: 'candidate', room } });
        }

        const legacyResult = await pool.query(
            `SELECT
                mr.id, mr.name, mr.location, mr.description, mr.meeting_link,
                mr.jitsi_room_id, mr.recording_status, mr.recording_url,
                mr.queue_status, mr.confirmed_at, mr.checked_in_at, mr.admitted_at,
                mr.started_at, mr.ended_at, mr.start_time, mr.end_time,
                mr.access_token,
                aj.id AS application_id,
                aj.interview_at,
                aj.interview_mode,
                u.full_name AS candidate_name,
                j.job_title,
                j.company_name
             FROM meeting_rooms mr
             LEFT JOIN applied_jobs aj ON aj.id = mr.application_id
             LEFT JOIN users u ON u.id = aj.user_id
             LEFT JOIN jobs j ON j.id = COALESCE(mr.job_id, aj.job_id)
             WHERE mr.access_token = $1
             LIMIT 1`,
            [token]
        );

        const legacyRoom = legacyResult.rows[0];
        if (!legacyRoom) return res.status(404).json({ error: 'Phòng phỏng vấn không tồn tại hoặc link đã hết hiệu lực' });

        legacyRoom.queue_position = await getLegacyRoomQueuePosition(pool, legacyRoom.id);
        legacyRoom.can_join = legacyRoom.queue_status === 'in_interview';
        delete legacyRoom.access_token;

        return res.json({ data: { role: 'candidate', room: legacyRoom } });
    } catch (error) {
        console.error('Get meeting room access error:', error);
        res.status(500).json({ error: 'Lỗi khi tải phòng phỏng vấn' });
    }
};

exports.confirmRoomAccess = async (req, res) => {
    const client = await pool.connect();

    try {
        const { token } = req.params;
        await client.query('BEGIN');

        const scheduleResult = await client.query(
            `SELECT ms.id, ms.meeting_room_id, ms.queue_status, ms.ended_at, mr.host_joined_at
             FROM meeting_schedules ms
             JOIN meeting_rooms mr ON mr.id = ms.meeting_room_id
             WHERE ms.access_token = $1
             FOR UPDATE OF ms, mr`,
            [token]
        );

        const schedule = scheduleResult.rows[0];
        if (schedule) {
            await client.query(
                `UPDATE meeting_schedules
                 SET confirmed_at = COALESCE(confirmed_at, NOW()),
                     checked_in_at = COALESCE(checked_in_at, NOW()),
                     queue_status = CASE
                       WHEN queue_status = 'in_interview' THEN queue_status
                       WHEN ended_at IS NOT NULL THEN 'completed'
                       ELSE 'waiting'
                     END,
                     updated_at = NOW()
                 WHERE id = $1`,
                [schedule.id]
            );

            if (schedule.host_joined_at) {
                await admitFirstWaitingCandidate(client, schedule.meeting_room_id);
            }

            const updated = await client.query(
                `SELECT
                    ms.id AS schedule_id,
                    ms.confirmed_at,
                    ms.checked_in_at,
                    ms.admitted_at,
                    ms.started_at,
                    ms.ended_at,
                    ms.queue_status,
                    mr.host_joined_at
                 FROM meeting_schedules ms
                 JOIN meeting_rooms mr ON mr.id = ms.meeting_room_id
                 WHERE ms.id = $1`,
                [schedule.id]
            );
            const queuePosition = await getCandidateQueuePosition(client, schedule.id);
            await client.query('COMMIT');

            const data = updated.rows[0];
            return res.json({
                data: {
                    ...data,
                    queue_position: queuePosition,
                    can_join: Boolean(data.host_joined_at) && data.queue_status === 'in_interview',
                },
            });
        }

        const legacyRoomResult = await client.query(
            `SELECT id, employer_id, job_id, interview_date, queue_status
             FROM meeting_rooms
             WHERE access_token = $1
             FOR UPDATE`,
            [token]
        );

        const room = legacyRoomResult.rows[0];
        if (!room) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Không thể xác nhận phòng phỏng vấn' });
        }

        await client.query(
            `UPDATE meeting_rooms
             SET confirmed_at = COALESCE(confirmed_at, NOW()),
                 checked_in_at = COALESCE(checked_in_at, NOW()),
                 queue_status = CASE
                   WHEN queue_status = 'in_interview' THEN queue_status
                   WHEN ended_at IS NOT NULL THEN 'completed'
                   ELSE 'waiting'
                 END,
                 updated_at = NOW()
             WHERE id = $1`,
            [room.id]
        );

        await admitFirstWaitingRoom(client, {
            employerId: room.employer_id,
            jobId: room.job_id,
            interviewDate: room.interview_date,
        });

        const updated = await client.query(
            `SELECT id, confirmed_at, checked_in_at, admitted_at, started_at, ended_at, queue_status
             FROM meeting_rooms
             WHERE id = $1`,
            [room.id]
        );
        const queuePosition = await getLegacyRoomQueuePosition(client, room.id);
        await client.query('COMMIT');

        const data = updated.rows[0];
        res.json({
            data: {
                ...data,
                queue_position: queuePosition,
                can_join: data.queue_status === 'in_interview',
            },
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Confirm meeting room access error:', error);
        res.status(500).json({ error: 'Lỗi khi xác nhận tham gia phỏng vấn' });
    } finally {
        client.release();
    }
};

exports.updateRecordingStatus = async (req, res) => {
    try {
        const { token } = req.params;
        const { recording_status, recording_url } = req.body || {};
        const allowedStatuses = ['idle', 'recording', 'stored', 'failed'];
        const normalizedStatus = allowedStatuses.includes(recording_status) ? recording_status : 'idle';

        const result = await pool.query(
            `UPDATE meeting_rooms
             SET recording_status = $1,
                 recording_url = COALESCE($2, recording_url),
                 updated_at = NOW()
             WHERE host_token = $3
             RETURNING id, recording_status, recording_url`,
            [normalizedStatus, recording_url || null, token]
        );

        if (!result.rows.length) {
            return res.status(404).json({ error: 'Không có quyền cập nhật ghi hình phòng này' });
        }

        res.json({ data: result.rows[0] });
    } catch (error) {
        console.error('Update recording status error:', error);
        res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái ghi hình' });
    }
};

exports.markHostJoined = async (req, res) => {
    const client = await pool.connect();

    try {
        const { token } = req.params;
        await client.query('BEGIN');

        const roomResult = await client.query(
            `UPDATE meeting_rooms
             SET host_joined_at = COALESCE(host_joined_at, NOW()),
                 updated_at = NOW()
             WHERE host_token = $1
             RETURNING id, host_joined_at`,
            [token]
        );

        const room = roomResult.rows[0];
        if (!room) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Không có quyền mở phòng HR' });
        }

        const admitted = await admitFirstWaitingCandidate(client, room.id);
        const candidates = await getRoomCandidates(client, room.id);
        const roomStatus = deriveRoomQueueStatus({ queue_status: 'invited' }, candidates);
        await client.query(
            `UPDATE meeting_rooms
             SET queue_status = $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [roomStatus, room.id]
        );

        await client.query('COMMIT');

        const currentCandidate = getCurrentCandidate(candidates);
        return res.json({
            data: {
                room_id: room.id,
                host_joined_at: room.host_joined_at,
                room_status: roomStatus,
                admitted_schedule_id: admitted?.id || null,
                current_candidate: currentCandidate,
            },
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Mark host joined error:', error);
        return res.status(500).json({ error: 'Lỗi khi mở phòng HR' });
    } finally {
        client.release();
    }
};

exports.completeCurrentInterview = async (req, res) => {
    const client = await pool.connect();

    try {
        const { token } = req.params;
        await client.query('BEGIN');

        const roomResult = await client.query(
            `SELECT id, employer_id, job_id, interview_date
             FROM meeting_rooms
             WHERE host_token = $1
             FOR UPDATE`,
            [token]
        );

        const room = roomResult.rows[0];
        if (!room) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Không có quyền hoàn tất phòng này' });
        }

        const completed = await client.query(
            `UPDATE meeting_schedules
             SET queue_status = 'completed',
                 ended_at = COALESCE(ended_at, NOW()),
                 updated_at = NOW()
             WHERE id = (
               SELECT id
               FROM meeting_schedules
               WHERE meeting_room_id = $1
                 AND queue_status = 'in_interview'
                 AND ended_at IS NULL
               ORDER BY admitted_at ASC NULLS LAST, id ASC
               LIMIT 1
             )
             RETURNING id`,
            [room.id]
        );

        const admitted = await admitFirstWaitingCandidate(client, room.id);

        let nextCandidate = null;
        if (admitted?.id) {
            const nextResult = await client.query(
                `SELECT
                    ms.id AS schedule_id,
                    ms.application_id,
                    u.full_name AS candidate_name,
                    aj.interview_at
                 FROM meeting_schedules ms
                 LEFT JOIN applied_jobs aj ON aj.id = ms.application_id
                 LEFT JOIN users u ON u.id = COALESCE(ms.seeker_id, aj.user_id)
                 WHERE ms.id = $1`,
                [admitted.id]
            );
            nextCandidate = nextResult.rows[0] || null;
        }

        const statusResult = await client.query(
            `SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE queue_status = 'in_interview')::int AS active_count,
                COUNT(*) FILTER (WHERE queue_status = 'waiting')::int AS waiting_count,
                COUNT(*) FILTER (WHERE queue_status = 'completed' OR ended_at IS NOT NULL)::int AS completed_count
             FROM meeting_schedules
             WHERE meeting_room_id = $1`,
            [room.id]
        );
        const status = statusResult.rows[0] || {};
        const roomStatus = status.active_count > 0
            ? 'in_interview'
            : status.waiting_count > 0
                ? 'waiting'
                : status.total > 0 && status.completed_count === status.total
                    ? 'completed'
                    : 'invited';

        await client.query(
            `UPDATE meeting_rooms
             SET queue_status = $1,
                 ended_at = CASE WHEN $1 = 'completed' THEN COALESCE(ended_at, NOW()) ELSE ended_at END,
                 updated_at = NOW()
             WHERE id = $2`,
            [roomStatus, room.id]
        );

        await client.query('COMMIT');
        res.json({
            data: {
                completed_room_id: room.id,
                completed_schedule_id: completed.rows[0]?.id || null,
                room_status: roomStatus,
                next_candidate: nextCandidate
                    ? {
                        ...nextCandidate,
                        host_path: `/interview-room/${token}`,
                      }
                    : null,
            },
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Complete interview room error:', error);
        res.status(500).json({ error: 'Lỗi khi hoàn tất lượt phỏng vấn' });
    } finally {
        client.release();
    }
};

// 2. Tạo phòng họp mới
exports.createRoom = async (req, res) => {
    try {
        const { name, location, capacity, description, meeting_link } = normalizeRoomPayload(req.body);
        if (!name) return res.status(400).json({ message: 'Tên phòng meeting là bắt buộc' });

        const result = await pool.query(
            `INSERT INTO meeting_rooms (employer_id, name, location, capacity, description, meeting_link)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [req.user.id, name, location, capacity, description, meeting_link]
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
        const { name, location, capacity, description, meeting_link } = normalizeRoomPayload(req.body);
        if (!name) return res.status(400).json({ message: 'Tên phòng meeting là bắt buộc' });

        const result = await pool.query(
            `UPDATE meeting_rooms
             SET employer_id = COALESCE(employer_id, $1),
                 name = $2,
                 location = $3,
                 capacity = $4,
                 description = $5,
                 meeting_link = $6,
                 updated_at = NOW()
             WHERE id = $7 AND (employer_id = $1 OR employer_id IS NULL)
             RETURNING *`,
            [req.user.id, name, location, capacity, description, meeting_link, id]
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
        const result = await pool.query(
            'DELETE FROM meeting_rooms WHERE id = $1 AND (employer_id = $2 OR employer_id IS NULL) RETURNING *',
            [id, req.user.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ message: 'Room not found' });
        res.json({ message: 'Room deleted' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// 5. Đặt lịch họp và kiểm tra trùng
exports.bookMeeting = async (req, res) => {
    const { roomId, seekerId, startTime, endTime, title } = req.body;
    const employerId = req.user.id;

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
    if (String(req.user.id) !== String(userId) && req.user.role_code !== 'admin') {
        return res.status(403).json({ message: 'Không có quyền xem lịch họp này' });
    }

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
