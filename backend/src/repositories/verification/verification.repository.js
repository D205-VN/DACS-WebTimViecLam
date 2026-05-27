const pool = require('../../infrastructure/database/postgres');

async function query(sql, params = [], client = pool) {
  return client.query(sql, params);
}

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function getUserFullName(userId, client = pool) {
  const result = await query('SELECT full_name FROM users WHERE id = $1 LIMIT 1', [userId], client);
  return result.rows[0]?.full_name || '';
}

async function findCvForOwner(cvId, userId, client = pool) {
  const result = await query(
    `SELECT c.id, c.user_id, c.title, c.target_role, c.html_content, c.current_location, c.current_lat, c.current_lng,
            c.created_at, u.full_name
     FROM user_cvs c
     JOIN users u ON c.user_id = u.id
     WHERE c.id = $1 AND c.user_id = $2`,
    [cvId, userId],
    client
  );

  return result.rows[0] || null;
}

async function findCertificateForOwner(certificateId, userId, client = pool) {
  const result = await query(
    `SELECT c.*, u.full_name
     FROM user_certifications c
     JOIN users u ON c.user_id = u.id
     WHERE c.id = $1 AND c.user_id = $2`,
    [certificateId, userId],
    client
  );

  return result.rows[0] || null;
}

async function findWorkHistoryForOwner(workHistoryId, userId, client = pool) {
  const result = await query(
    `SELECT w.*, u.full_name
     FROM user_work_histories w
     JOIN users u ON w.user_id = u.id
     WHERE w.id = $1 AND w.user_id = $2`,
    [workHistoryId, userId],
    client
  );

  return result.rows[0] || null;
}

async function findCvOverview(userId) {
  const result = await query(
    `SELECT c.id, c.title, c.target_role, c.created_at, c.is_primary,
            c.current_location,
            chain.verification_code,
            chain.block_hash,
            chain.payload_hash,
            chain.anchor_network,
            chain.chain_id,
            chain.anchor_tx_hash,
            chain.anchor_address,
            chain.anchor_error,
            chain.anchored_at,
            chain.created_at as notarized_at
     FROM user_cvs c
     LEFT JOIN LATERAL (
       SELECT verification_code, block_hash, payload_hash, anchor_network, chain_id,
              anchor_tx_hash, anchor_address, anchor_error, anchored_at, created_at
       FROM blockchain_blocks
       WHERE asset_type = 'cv' AND asset_id = c.id AND owner_user_id = c.user_id
       ORDER BY block_index DESC
       LIMIT 1
     ) chain ON TRUE
     WHERE c.user_id = $1
     ORDER BY c.is_primary DESC, c.created_at DESC, c.id DESC`,
    [userId]
  );

  return result.rows;
}

async function findCertificates(userId) {
  const result = await query(
    `SELECT c.id, c.certificate_name, c.issuer_name, c.credential_id, c.issue_date, c.expiry_date,
            c.document_url, c.notes, c.status, c.verification_code, c.created_at, c.updated_at,
            b.anchor_network, b.chain_id, b.anchor_tx_hash, b.anchor_address, b.anchor_error, b.anchored_at
     FROM user_certifications c
     LEFT JOIN blockchain_blocks b ON b.id = c.block_id
     WHERE c.user_id = $1
     ORDER BY c.created_at DESC, c.id DESC`,
    [userId]
  );

  return result.rows;
}

async function findWorkHistories(userId) {
  const result = await query(
    `SELECT w.id, w.company_name, w.job_title, w.employment_type, w.start_date, w.end_date,
            w.currently_working, w.summary, w.status, w.verification_code, w.created_at, w.updated_at,
            b.anchor_network, b.chain_id, b.anchor_tx_hash, b.anchor_address, b.anchor_error, b.anchored_at
     FROM user_work_histories w
     LEFT JOIN blockchain_blocks b ON b.id = w.block_id
     WHERE w.user_id = $1
     ORDER BY w.start_date DESC NULLS LAST, w.created_at DESC, w.id DESC`,
    [userId]
  );

  return result.rows;
}

async function insertCertificate(client, payload) {
  const result = await query(
    `INSERT INTO user_certifications (
       user_id, certificate_name, issuer_name, credential_id, issue_date, expiry_date,
       document_url, notes, status, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', NOW(), NOW())
     RETURNING *`,
    [
      payload.userId,
      payload.certificateName,
      payload.issuerName,
      payload.credentialId,
      payload.issueDate,
      payload.expiryDate,
      payload.documentUrl,
      payload.notes,
    ],
    client
  );

  return result.rows[0] || null;
}

async function attachCertificateBlock(client, { certificateId, userId, blockId, verificationCode }) {
  const result = await query(
    `UPDATE user_certifications
     SET block_id = $1, verification_code = $2, updated_at = NOW()
     WHERE id = $3 AND user_id = $4
     RETURNING id, certificate_name, issuer_name, credential_id, issue_date, expiry_date,
               document_url, notes, status, verification_code, created_at, updated_at`,
    [blockId, verificationCode, certificateId, userId],
    client
  );

  return result.rows[0] || null;
}

async function revokeCertificate(userId, certificateId) {
  const result = await query(
    `UPDATE user_certifications
     SET status = 'revoked', updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id, certificate_name, issuer_name, verification_code, status, updated_at`,
    [certificateId, userId]
  );

  return result.rows[0] || null;
}

async function insertWorkHistory(client, payload) {
  const result = await query(
    `INSERT INTO user_work_histories (
       user_id, company_name, job_title, employment_type, start_date, end_date,
       currently_working, summary, status, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', NOW(), NOW())
     RETURNING *`,
    [
      payload.userId,
      payload.companyName,
      payload.jobTitle,
      payload.employmentType,
      payload.startDate,
      payload.endDate,
      payload.currentlyWorking,
      payload.summary,
    ],
    client
  );

  return result.rows[0] || null;
}

async function attachWorkHistoryBlock(client, { workHistoryId, userId, blockId, verificationCode }) {
  const result = await query(
    `UPDATE user_work_histories
     SET block_id = $1, verification_code = $2, updated_at = NOW()
     WHERE id = $3 AND user_id = $4
     RETURNING id, company_name, job_title, employment_type, start_date, end_date,
               currently_working, summary, status, verification_code, created_at, updated_at`,
    [blockId, verificationCode, workHistoryId, userId],
    client
  );

  return result.rows[0] || null;
}

async function revokeWorkHistory(userId, workHistoryId) {
  const result = await query(
    `UPDATE user_work_histories
     SET status = 'revoked', updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id, company_name, job_title, verification_code, status, updated_at`,
    [workHistoryId, userId]
  );

  return result.rows[0] || null;
}

async function findBlockByVerificationCode(verificationCode) {
  const result = await query(
    `SELECT id, block_index, asset_type, asset_id, owner_user_id, verification_code, payload_hash,
            previous_hash, block_hash, anchor_network, chain_id, anchor_tx_hash,
            anchor_address, anchor_error, anchored_at, metadata, created_at
     FROM blockchain_blocks
     WHERE verification_code = $1
     LIMIT 1`,
    [verificationCode]
  );

  return result.rows[0] || null;
}

async function findBlockByHash(blockHash) {
  const result = await query(
    `SELECT block_hash
     FROM blockchain_blocks
     WHERE block_hash = $1
     LIMIT 1`,
    [blockHash]
  );

  return result.rows[0] || null;
}

async function findCvPublicAsset(cvId) {
  const result = await query(
    `SELECT c.id, c.title, c.target_role, c.current_location, c.html_content,
            c.current_lat, c.current_lng, c.created_at, u.full_name
     FROM user_cvs c
     JOIN users u ON c.user_id = u.id
     WHERE c.id = $1`,
    [cvId]
  );

  return result.rows[0] || null;
}

async function findCertificatePublicAsset(certificateId) {
  const result = await query(
    `SELECT c.*, u.full_name
     FROM user_certifications c
     JOIN users u ON c.user_id = u.id
     WHERE c.id = $1`,
    [certificateId]
  );

  return result.rows[0] || null;
}

async function findWorkHistoryPublicAsset(workHistoryId) {
  const result = await query(
    `SELECT w.*, u.full_name
     FROM user_work_histories w
     JOIN users u ON w.user_id = u.id
     WHERE w.id = $1`,
    [workHistoryId]
  );

  return result.rows[0] || null;
}

async function findLatestBlockForAsset(assetType, assetId) {
  const result = await query(
    `SELECT verification_code, block_hash
     FROM blockchain_blocks
     WHERE asset_type = $1 AND asset_id = $2
     ORDER BY block_index DESC
     LIMIT 1`,
    [assetType, assetId]
  );

  return result.rows[0] || null;
}

module.exports = {
  attachCertificateBlock,
  attachWorkHistoryBlock,
  findBlockByHash,
  findBlockByVerificationCode,
  findCertificateForOwner,
  findCertificatePublicAsset,
  findCertificates,
  findCvForOwner,
  findCvOverview,
  findCvPublicAsset,
  findLatestBlockForAsset,
  findWorkHistories,
  findWorkHistoryForOwner,
  findWorkHistoryPublicAsset,
  getUserFullName,
  insertCertificate,
  insertWorkHistory,
  revokeCertificate,
  revokeWorkHistory,
  withTransaction,
};
