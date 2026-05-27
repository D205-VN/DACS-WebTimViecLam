const AppError = require('../core/errors/AppError');
const { ensureUserAccountStatusSchema } = require('../models/auth.model');
const { createNotification } = require('./notification.service');
const { ensureAdminJobSchema } = require('../models/admin.model');
const repository = require('../repositories/admin.repository');

async function ensureAdminSchema() {
  await ensureAdminJobSchema();
}

async function getStats() {
  await ensureAdminJobSchema();
  return repository.getStatsCounts();
}

async function getUsers() {
  await ensureUserAccountStatusSchema();
  return { data: await repository.findUsers() };
}

function checkJobForAiRejection(job) {
  const reasons = [];
  if (!job.job_title || job.job_title.trim().length < 5) reasons.push('Tiêu đề công việc quá ngắn hoặc trống.');
  if (!job.job_description || job.job_description.trim().length < 50) reasons.push('Mô tả công việc quá sơ sài (cần ít nhất 50 ký tự).');
  if (!job.job_address || job.job_address.trim().length < 5) reasons.push('Địa điểm làm việc không rõ ràng.');

  if (reasons.length > 0) {
    return {
      shouldReject: true,
      reason: `AI Đề xuất từ chối: ${reasons.join(' ')}`,
    };
  }

  return { shouldReject: false, reason: null };
}

async function getPendingJobs() {
  await ensureAdminJobSchema();
  const jobs = await repository.findPendingJobs();

  return {
    data: jobs.map((job) => ({
      ...job,
      ai_suggestion: checkJobForAiRejection(job).reason,
    })),
  };
}

async function updateJobStatus({ jobId, status, reason }) {
  if (!['approved', 'rejected'].includes(status)) {
    throw new AppError('Trạng thái không hợp lệ', 400, 'INVALID_JOB_STATUS');
  }

  await ensureAdminJobSchema();
  const job = await repository.updateJobStatus({ jobId, status, reason });
  if (!job) throw new AppError('Không tìm thấy việc làm', 404, 'JOB_NOT_FOUND');

  if (job.employer_id) {
    await createNotification({
      userId: job.employer_id,
      type: status === 'approved' ? 'employer_job_approved' : 'employer_job_rejected',
      title: status === 'approved' ? 'Tin tuyển dụng đã được duyệt' : 'Tin tuyển dụng bị từ chối',
      message:
        status === 'approved'
          ? `Admin đã duyệt tin "${job.job_title}" của bạn.`
          : `Admin đã từ chối tin "${job.job_title}" của bạn. Lý do: ${reason || 'Không có lý do cụ thể'}`,
      to: '/employer/dashboard',
      tab: 'jobs',
      meta: { job_id: job.id, reason },
    }).catch((notificationError) => {
      console.error('Create employer moderation notification error:', notificationError);
    });
  }

  return { message: 'Cập nhật trạng thái thành công', data: job };
}

async function toggleUserSuspend({ targetUserId, suspended, actorUserId }) {
  if (typeof suspended !== 'boolean') {
    throw new AppError('Trường suspended phải là boolean', 400, 'INVALID_SUSPENDED_VALUE');
  }

  await ensureUserAccountStatusSchema();
  if (Number(targetUserId) === Number(actorUserId)) {
    throw new AppError('Không thể tạm dừng tài khoản của chính mình', 400, 'CANNOT_SUSPEND_SELF');
  }

  const user = await repository.updateUserSuspension({ userId: targetUserId, suspended });
  if (!user) throw new AppError('Không tìm thấy người dùng', 404, 'USER_NOT_FOUND');

  return {
    message: suspended
      ? `Đã tạm dừng tài khoản "${user.full_name}"`
      : `Đã kích hoạt lại tài khoản "${user.full_name}"`,
    data: user,
  };
}

module.exports = {
  ensureAdminSchema,
  getPendingJobs,
  getStats,
  getUsers,
  toggleUserSuspend,
  updateJobStatus,
};
