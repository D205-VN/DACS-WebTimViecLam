const pool = require('../../infrastructure/database/postgres');
const { ensureCvSchema } = require('../cv/cv.model');
const {
  buildAssetMetadata,
  buildCertificatePayload,
  buildCvPayload,
  buildWorkHistoryPayload,
  createBlockchainBlock,
  ensureVerificationSchema,
  formatDateValue,
  getLatestAssetBlock,
  hashPayload,
  validateBlockchainRecord,
} = require('./verification.model');

function requireSeekerRole(req, res) {
  if (req.user?.role_code !== 'seeker') {
    res.status(403).json({ error: 'Chỉ ứng viên mới có quyền truy cập tính năng blockchain verification' });
    return false;
  }

  return true;
}

function buildPublicVerificationUrl(req, verificationCode) {
  return `/verify/${verificationCode}`;
}

async function getUserFullName(userId, client = pool) {
  const result = await client.query(
    'SELECT full_name FROM users WHERE id = $1 LIMIT 1',
    [userId]
  );

  return result.rows[0]?.full_name || '';
}

async function loadCvForOwner(cvId, userId, client = pool) {
  const result = await client.query(
    `SELECT c.id, c.user_id, c.title, c.target_role, c.html_content, c.current_location, c.current_lat, c.current_lng,
            c.created_at, u.full_name
     FROM user_cvs c
     JOIN users u ON c.user_id = u.id
     WHERE c.id = $1 AND c.user_id = $2`,
    [cvId, userId]
  );

  return result.rows[0] || null;
}

async function loadCertificateForOwner(certificateId, userId, client = pool) {
  const result = await client.query(
    `SELECT c.*, u.full_name
     FROM user_certifications c
     JOIN users u ON c.user_id = u.id
     WHERE c.id = $1 AND c.user_id = $2`,
    [certificateId, userId]
  );

  return result.rows[0] || null;
}

async function loadWorkHistoryForOwner(workHistoryId, userId, client = pool) {
  const result = await client.query(
    `SELECT w.*, u.full_name
     FROM user_work_histories w
     JOIN users u ON w.user_id = u.id
     WHERE w.id = $1 AND w.user_id = $2`,
    [workHistoryId, userId]
  );

  return result.rows[0] || null;
}

async function getOverview(req, res) {
  if (!requireSeekerRole(req, res)) return;

  try {
    await ensureCvSchema();
    await ensureVerificationSchema();

    const [cvsResult, certificateResult, workHistoryResult] = await Promise.all([
      pool.query(
        `SELECT c.id, c.title, c.target_role, c.created_at, c.is_primary,
                c.current_location,
                chain.verification_code,
                chain.block_hash,
                chain.payload_hash,
                chain.created_at as notarized_at
         FROM user_cvs c
         LEFT JOIN LATERAL (
           SELECT verification_code, block_hash, payload_hash, created_at
           FROM blockchain_blocks
           WHERE asset_type = 'cv' AND asset_id = c.id AND owner_user_id = c.user_id
           ORDER BY block_index DESC
           LIMIT 1
         ) chain ON TRUE
         WHERE c.user_id = $1
         ORDER BY c.is_primary DESC, c.created_at DESC, c.id DESC`,
        [req.user.id]
      ),
      pool.query(
        `SELECT id, certificate_name, issuer_name, credential_id, issue_date, expiry_date, document_url,
                notes, status, verification_code, created_at, updated_at
         FROM user_certifications
         WHERE user_id = $1
         ORDER BY created_at DESC, id DESC`,
        [req.user.id]
      ),
      pool.query(
        `SELECT id, company_name, job_title, employment_type, start_date, end_date,
                currently_working, summary, status, verification_code, created_at, updated_at
         FROM user_work_histories
         WHERE user_id = $1
         ORDER BY start_date DESC NULLS LAST, created_at DESC, id DESC`,
        [req.user.id]
      ),
    ]);

    res.json({
      data: {
        cvs: cvsResult.rows.map((row) => ({
          ...row,
          public_url: row.verification_code ? buildPublicVerificationUrl(req, row.verification_code) : null,
        })),
        certificates: certificateResult.rows.map((row) => ({
          ...row,
          public_url: row.verification_code ? buildPublicVerificationUrl(req, row.verification_code) : null,
        })),
        workHistories: workHistoryResult.rows.map((row) => ({
          ...row,
          public_url: row.verification_code ? buildPublicVerificationUrl(req, row.verification_code) : null,
        })),
      },
    });
  } catch (err) {
    console.error('Get blockchain verification overview error:', err);
    res.status(500).json({ error: 'Không thể tải dữ liệu blockchain verification' });
  }
}

async function notarizeCv(req, res) {
  if (!requireSeekerRole(req, res)) return;

  const cvId = Number(req.params.id);
  if (!Number.isInteger(cvId) || cvId <= 0) {
    return res.status(400).json({ error: 'Mã CV không hợp lệ' });
  }

  try {
    await ensureCvSchema();
    await ensureVerificationSchema();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const cv = await loadCvForOwner(cvId, req.user.id, client);

      if (!cv) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(404).json({ error: 'Không tìm thấy CV để xác thực blockchain' });
      }

      const payload = buildCvPayload(cv);
      const latestBlock = await getLatestAssetBlock({
        assetType: 'cv',
        assetId: cv.id,
        ownerUserId: req.user.id,
      }, client);
      const currentPayloadHash = hashPayload(payload);

      if (latestBlock && latestBlock.payload_hash === currentPayloadHash) {
        await client.query('COMMIT');
        client.release();
        return res.json({
          message: 'CV này đã được xác thực blockchain với nội dung hiện tại.',
          data: {
            verification_code: latestBlock.verification_code,
            block_hash: latestBlock.block_hash,
            payload_hash: latestBlock.payload_hash,
            notarized_at: latestBlock.created_at,
            public_url: buildPublicVerificationUrl(req, latestBlock.verification_code),
          },
        });
      }

      const block = await createBlockchainBlock({
        assetType: 'cv',
        assetId: cv.id,
        ownerUserId: req.user.id,
        payload,
        metadata: buildAssetMetadata('cv', cv, cv.full_name),
      }, client);

      await client.query('COMMIT');
      client.release();

      res.status(201).json({
        message: 'Đã ghi CV lên blockchain ledger nội bộ.',
        data: {
          verification_code: block.verification_code,
          block_hash: block.block_hash,
          payload_hash: block.payload_hash,
          notarized_at: block.created_at,
          public_url: buildPublicVerificationUrl(req, block.verification_code),
        },
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
      throw err;
    }
  } catch (err) {
    console.error('Notarize CV error:', err);
    res.status(500).json({ error: 'Không thể xác thực CV bằng blockchain' });
  }
}

async function createCertificate(req, res) {
  if (!requireSeekerRole(req, res)) return;

  const {
    certificate_name,
    issuer_name,
    credential_id,
    issue_date,
    expiry_date,
    document_url,
    notes,
  } = req.body || {};

  if (!String(certificate_name || '').trim() || !String(issuer_name || '').trim()) {
    return res.status(400).json({ error: 'Tên chứng chỉ và đơn vị cấp là bắt buộc' });
  }

  try {
    await ensureVerificationSchema();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const ownerName = await getUserFullName(req.user.id, client);
      const insertResult = await client.query(
      `INSERT INTO user_certifications (
         user_id, certificate_name, issuer_name, credential_id, issue_date, expiry_date,
         document_url, notes, status, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', NOW(), NOW())
       RETURNING *`,
      [
        req.user.id,
        String(certificate_name || '').trim(),
        String(issuer_name || '').trim(),
        String(credential_id || '').trim() || null,
        formatDateValue(issue_date),
        formatDateValue(expiry_date),
        String(document_url || '').trim() || null,
        String(notes || '').trim() || null,
      ]
    );

      const certificate = insertResult.rows[0];
      const block = await createBlockchainBlock({
        assetType: 'certificate',
        assetId: certificate.id,
        ownerUserId: req.user.id,
        payload: buildCertificatePayload(certificate),
        metadata: buildAssetMetadata('certificate', certificate, ownerName),
      }, client);

      const updateResult = await client.query(
      `UPDATE user_certifications
       SET block_id = $1, verification_code = $2, updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING id, certificate_name, issuer_name, credential_id, issue_date, expiry_date,
                 document_url, notes, status, verification_code, created_at, updated_at`,
        [block.id, block.verification_code, certificate.id, req.user.id]
      );

      await client.query('COMMIT');
      client.release();

      res.status(201).json({
        message: 'Đã tạo chứng chỉ và ghi nhận lên blockchain ledger nội bộ.',
        data: {
          ...updateResult.rows[0],
          public_url: buildPublicVerificationUrl(req, block.verification_code),
        },
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
      throw err;
    }
  } catch (err) {
    console.error('Create certificate verification error:', err);
    res.status(500).json({ error: 'Không thể tạo chứng chỉ xác thực' });
  }
}

async function getCertificates(req, res) {
  if (!requireSeekerRole(req, res)) return;

  try {
    await ensureVerificationSchema();
    const result = await pool.query(
      `SELECT id, certificate_name, issuer_name, credential_id, issue_date, expiry_date, document_url,
              notes, status, verification_code, created_at, updated_at
       FROM user_certifications
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC`,
      [req.user.id]
    );

    res.json({
      data: result.rows.map((row) => ({
        ...row,
        public_url: row.verification_code ? buildPublicVerificationUrl(req, row.verification_code) : null,
      })),
    });
  } catch (err) {
    console.error('Get certificates verification error:', err);
    res.status(500).json({ error: 'Không thể tải danh sách chứng chỉ xác thực' });
  }
}

async function revokeCertificate(req, res) {
  if (!requireSeekerRole(req, res)) return;

  const certificateId = Number(req.params.id);
  if (!Number.isInteger(certificateId) || certificateId <= 0) {
    return res.status(400).json({ error: 'Mã chứng chỉ không hợp lệ' });
  }

  try {
    await ensureVerificationSchema();
    const result = await pool.query(
      `UPDATE user_certifications
       SET status = 'revoked', updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, certificate_name, issuer_name, verification_code, status, updated_at`,
      [certificateId, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Không tìm thấy chứng chỉ để thu hồi' });
    }

    res.json({
      message: 'Chứng chỉ đã được đánh dấu thu hồi.',
      data: {
        ...result.rows[0],
        public_url: result.rows[0].verification_code ? buildPublicVerificationUrl(req, result.rows[0].verification_code) : null,
      },
    });
  } catch (err) {
    console.error('Revoke certificate verification error:', err);
    res.status(500).json({ error: 'Không thể thu hồi chứng chỉ xác thực' });
  }
}

async function createWorkHistory(req, res) {
  if (!requireSeekerRole(req, res)) return;

  const {
    company_name,
    job_title,
    employment_type,
    start_date,
    end_date,
    currently_working,
    summary,
  } = req.body || {};

  if (!String(company_name || '').trim() || !String(job_title || '').trim()) {
    return res.status(400).json({ error: 'Tên công ty và chức danh là bắt buộc' });
  }

  try {
    await ensureVerificationSchema();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const ownerName = await getUserFullName(req.user.id, client);
      const insertResult = await client.query(
      `INSERT INTO user_work_histories (
         user_id, company_name, job_title, employment_type, start_date, end_date,
         currently_working, summary, status, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', NOW(), NOW())
       RETURNING *`,
      [
        req.user.id,
        String(company_name || '').trim(),
        String(job_title || '').trim(),
        String(employment_type || '').trim() || null,
        formatDateValue(start_date),
        currently_working ? null : formatDateValue(end_date),
        Boolean(currently_working),
        String(summary || '').trim() || null,
      ]
    );

      const workHistory = insertResult.rows[0];
      const block = await createBlockchainBlock({
        assetType: 'work_history',
        assetId: workHistory.id,
        ownerUserId: req.user.id,
        payload: buildWorkHistoryPayload(workHistory),
        metadata: buildAssetMetadata('work_history', workHistory, ownerName),
      }, client);

      const updateResult = await client.query(
      `UPDATE user_work_histories
       SET block_id = $1, verification_code = $2, updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING id, company_name, job_title, employment_type, start_date, end_date,
                 currently_working, summary, status, verification_code, created_at, updated_at`,
        [block.id, block.verification_code, workHistory.id, req.user.id]
      );

      await client.query('COMMIT');
      client.release();

      res.status(201).json({
        message: 'Đã tạo lịch sử làm việc và ghi nhận lên blockchain ledger nội bộ.',
        data: {
          ...updateResult.rows[0],
          public_url: buildPublicVerificationUrl(req, block.verification_code),
        },
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
      throw err;
    }
  } catch (err) {
    console.error('Create work history verification error:', err);
    res.status(500).json({ error: 'Không thể tạo lịch sử làm việc xác thực' });
  }
}

async function getWorkHistories(req, res) {
  if (!requireSeekerRole(req, res)) return;

  try {
    await ensureVerificationSchema();
    const result = await pool.query(
      `SELECT id, company_name, job_title, employment_type, start_date, end_date,
              currently_working, summary, status, verification_code, created_at, updated_at
       FROM user_work_histories
       WHERE user_id = $1
       ORDER BY start_date DESC NULLS LAST, created_at DESC, id DESC`,
      [req.user.id]
    );

    res.json({
      data: result.rows.map((row) => ({
        ...row,
        public_url: row.verification_code ? buildPublicVerificationUrl(req, row.verification_code) : null,
      })),
    });
  } catch (err) {
    console.error('Get work histories verification error:', err);
    res.status(500).json({ error: 'Không thể tải lịch sử làm việc xác thực' });
  }
}

async function revokeWorkHistory(req, res) {
  if (!requireSeekerRole(req, res)) return;

  const workHistoryId = Number(req.params.id);
  if (!Number.isInteger(workHistoryId) || workHistoryId <= 0) {
    return res.status(400).json({ error: 'Mã lịch sử làm việc không hợp lệ' });
  }

  try {
    await ensureVerificationSchema();
    const result = await pool.query(
      `UPDATE user_work_histories
       SET status = 'revoked', updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, company_name, job_title, verification_code, status, updated_at`,
      [workHistoryId, req.user.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Không tìm thấy lịch sử làm việc để thu hồi' });
    }

    res.json({
      message: 'Lịch sử làm việc đã được đánh dấu thu hồi.',
      data: {
        ...result.rows[0],
        public_url: result.rows[0].verification_code ? buildPublicVerificationUrl(req, result.rows[0].verification_code) : null,
      },
    });
  } catch (err) {
    console.error('Revoke work history verification error:', err);
    res.status(500).json({ error: 'Không thể thu hồi lịch sử làm việc xác thực' });
  }
}

async function getPublicVerification(req, res) {
  const verificationCode = String(req.params.code || '').trim().toUpperCase();
  if (!verificationCode) {
    return res.status(400).json({ error: 'Mã xác thực không hợp lệ' });
  }

  try {
    await ensureCvSchema();
    await ensureVerificationSchema();

    const blockResult = await pool.query(
      `SELECT id, block_index, asset_type, asset_id, owner_user_id, verification_code, payload_hash,
              previous_hash, block_hash, metadata, created_at
       FROM blockchain_blocks
       WHERE verification_code = $1
       LIMIT 1`,
      [verificationCode]
    );

    if (!blockResult.rows.length) {
      return res.status(404).json({ error: 'Không tìm thấy mã xác thực blockchain' });
    }

    const block = blockResult.rows[0];
    const previousBlockResult = block.previous_hash
      ? await pool.query(
          `SELECT block_hash
           FROM blockchain_blocks
           WHERE block_hash = $1
           LIMIT 1`,
          [block.previous_hash]
        )
      : { rows: [] };
    const previousBlock = previousBlockResult.rows[0] || null;
    const chainValidation = validateBlockchainRecord(block, previousBlock);

    let asset = null;
    let currentPayloadHash = null;

    if (block.asset_type === 'cv') {
      const cvResult = await pool.query(
        `SELECT c.id, c.title, c.target_role, c.current_location, c.html_content,
                c.current_lat, c.current_lng, c.created_at, u.full_name
         FROM user_cvs c
         JOIN users u ON c.user_id = u.id
         WHERE c.id = $1`,
        [block.asset_id]
      );
      const cv = cvResult.rows[0] || null;

      if (cv) {
        currentPayloadHash = hashPayload(buildCvPayload(cv));
        asset = {
          type: 'cv',
          owner_name: cv.full_name,
          title: cv.title,
          target_role: cv.target_role,
          current_location: cv.current_location,
          created_at: cv.created_at,
          status: 'active',
        };
      } else {
        asset = {
          type: 'cv',
          status: 'source_deleted',
        };
      }
    } else if (block.asset_type === 'certificate') {
      const certificateResult = await pool.query(
        `SELECT c.*, u.full_name
         FROM user_certifications c
         JOIN users u ON c.user_id = u.id
         WHERE c.id = $1`,
        [block.asset_id]
      );
      const certificate = certificateResult.rows[0] || null;

      if (certificate) {
        currentPayloadHash = hashPayload(buildCertificatePayload(certificate));
        asset = {
          type: 'certificate',
          owner_name: certificate.full_name,
          certificate_name: certificate.certificate_name,
          issuer_name: certificate.issuer_name,
          credential_id: certificate.credential_id,
          issue_date: certificate.issue_date,
          expiry_date: certificate.expiry_date,
          status: certificate.status,
        };
      } else {
        asset = {
          type: 'certificate',
          status: 'source_deleted',
        };
      }
    } else {
      const workHistoryResult = await pool.query(
        `SELECT w.*, u.full_name
         FROM user_work_histories w
         JOIN users u ON w.user_id = u.id
         WHERE w.id = $1`,
        [block.asset_id]
      );
      const workHistory = workHistoryResult.rows[0] || null;

      if (workHistory) {
        currentPayloadHash = hashPayload(buildWorkHistoryPayload(workHistory));
        asset = {
          type: 'work_history',
          owner_name: workHistory.full_name,
          company_name: workHistory.company_name,
          job_title: workHistory.job_title,
          employment_type: workHistory.employment_type,
          start_date: workHistory.start_date,
          end_date: workHistory.end_date,
          currently_working: workHistory.currently_working,
          status: workHistory.status,
        };
      } else {
        asset = {
          type: 'work_history',
          status: 'source_deleted',
        };
      }
    }

    const latestAssetBlock = await pool.query(
      `SELECT verification_code, block_hash
       FROM blockchain_blocks
       WHERE asset_type = $1 AND asset_id = $2
       ORDER BY block_index DESC
       LIMIT 1`,
      [block.asset_type, block.asset_id]
    );
    const latestVerification = latestAssetBlock.rows[0] || null;

    res.json({
      data: {
        verification_code: block.verification_code,
        block_index: block.block_index,
        asset_type: block.asset_type,
        verified_at: block.created_at,
        block_hash: block.block_hash,
        previous_hash: block.previous_hash,
        payload_hash: block.payload_hash,
        metadata: block.metadata || {},
        public_url: buildPublicVerificationUrl(req, block.verification_code),
        is_block_valid: chainValidation.isBlockValid,
        is_linked_to_previous: chainValidation.isLinkedToPrevious,
        is_latest_version: latestVerification?.verification_code === block.verification_code,
        matches_current_record: currentPayloadHash ? currentPayloadHash === block.payload_hash : false,
        asset,
      },
    });
  } catch (err) {
    console.error('Public blockchain verification error:', err);
    res.status(500).json({ error: 'Không thể kiểm tra mã xác thực blockchain' });
  }
}

module.exports = {
  createCertificate,
  createWorkHistory,
  getCertificates,
  getOverview,
  getPublicVerification,
  getWorkHistories,
  notarizeCv,
  revokeCertificate,
  revokeWorkHistory,
};
