const crypto = require('crypto');
const pool = require('../../infrastructure/database/postgres');

let verificationSchemaReady = false;

function formatDateValue(value) {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().split('T')[0];
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const normalized = String(value).trim();
    return normalized || null;
  }

  return parsed.toISOString().split('T')[0];
}

function stableSortValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stableSortValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = stableSortValue(value[key]);
        return result;
      }, {});
  }

  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableSortValue(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function buildCvPayload(row = {}) {
  return {
    title: String(row.title || '').trim(),
    target_role: String(row.target_role || '').trim(),
    html_content: String(row.html_content || '').trim(),
    current_location: String(row.current_location || '').trim(),
    current_lat: row.current_lat == null ? null : Number(row.current_lat),
    current_lng: row.current_lng == null ? null : Number(row.current_lng),
  };
}

function buildCertificatePayload(row = {}) {
  return {
    certificate_name: String(row.certificate_name || '').trim(),
    issuer_name: String(row.issuer_name || '').trim(),
    credential_id: String(row.credential_id || '').trim(),
    issue_date: formatDateValue(row.issue_date),
    expiry_date: formatDateValue(row.expiry_date),
    document_url: String(row.document_url || '').trim(),
    notes: String(row.notes || '').trim(),
  };
}

function buildWorkHistoryPayload(row = {}) {
  return {
    company_name: String(row.company_name || '').trim(),
    job_title: String(row.job_title || '').trim(),
    employment_type: String(row.employment_type || '').trim(),
    start_date: formatDateValue(row.start_date),
    end_date: formatDateValue(row.end_date),
    currently_working: Boolean(row.currently_working),
    summary: String(row.summary || '').trim(),
  };
}

function buildAssetMetadata(assetType, row = {}, ownerName = '') {
  if (assetType === 'cv') {
    return {
      owner_name: ownerName,
      title: row.title || 'CV',
      target_role: row.target_role || '',
      current_location: row.current_location || '',
    };
  }

  if (assetType === 'certificate') {
    return {
      owner_name: ownerName,
      certificate_name: row.certificate_name || '',
      issuer_name: row.issuer_name || '',
      issue_date: formatDateValue(row.issue_date),
      expiry_date: formatDateValue(row.expiry_date),
    };
  }

  return {
    owner_name: ownerName,
    company_name: row.company_name || '',
    job_title: row.job_title || '',
    start_date: formatDateValue(row.start_date),
    end_date: formatDateValue(row.end_date),
    currently_working: Boolean(row.currently_working),
  };
}

function buildBlockHash({
  blockIndex,
  assetType,
  assetId,
  ownerUserId,
  verificationCode,
  payloadHash,
  previousHash,
  metadata,
}) {
  return sha256(stableStringify({
    block_index: blockIndex,
    asset_type: assetType,
    asset_id: assetId,
    owner_user_id: ownerUserId,
    verification_code: verificationCode,
    payload_hash: payloadHash,
    previous_hash: previousHash || null,
    metadata: metadata || {},
  }));
}

function buildVerificationCode() {
  return `BLK-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

function hashPayload(payload) {
  return sha256(stableStringify(payload));
}

async function ensureVerificationSchema() {
  if (verificationSchemaReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS blockchain_blocks (
      id SERIAL PRIMARY KEY,
      block_index INTEGER NOT NULL UNIQUE,
      asset_type VARCHAR(50) NOT NULL,
      asset_id INTEGER,
      owner_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      verification_code VARCHAR(32) NOT NULL UNIQUE,
      payload_hash VARCHAR(64) NOT NULL,
      previous_hash VARCHAR(64),
      block_hash VARCHAR(64) NOT NULL UNIQUE,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_certifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      certificate_name VARCHAR(255) NOT NULL,
      issuer_name VARCHAR(255) NOT NULL,
      credential_id VARCHAR(255),
      issue_date DATE,
      expiry_date DATE,
      document_url TEXT,
      notes TEXT,
      status VARCHAR(30) DEFAULT 'active',
      block_id INTEGER REFERENCES blockchain_blocks(id) ON DELETE SET NULL,
      verification_code VARCHAR(32) UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_work_histories (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      company_name VARCHAR(255) NOT NULL,
      job_title VARCHAR(255) NOT NULL,
      employment_type VARCHAR(100),
      start_date DATE,
      end_date DATE,
      currently_working BOOLEAN DEFAULT FALSE,
      summary TEXT,
      status VARCHAR(30) DEFAULT 'active',
      block_id INTEGER REFERENCES blockchain_blocks(id) ON DELETE SET NULL,
      verification_code VARCHAR(32) UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE user_certifications
    ADD COLUMN IF NOT EXISTS credential_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS issue_date DATE,
    ADD COLUMN IF NOT EXISTS expiry_date DATE,
    ADD COLUMN IF NOT EXISTS document_url TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS block_id INTEGER REFERENCES blockchain_blocks(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS verification_code VARCHAR(32),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `);

  await pool.query(`
    ALTER TABLE user_work_histories
    ADD COLUMN IF NOT EXISTS employment_type VARCHAR(100),
    ADD COLUMN IF NOT EXISTS start_date DATE,
    ADD COLUMN IF NOT EXISTS end_date DATE,
    ADD COLUMN IF NOT EXISTS currently_working BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS summary TEXT,
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS block_id INTEGER REFERENCES blockchain_blocks(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS verification_code VARCHAR(32),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  `);

  verificationSchemaReady = true;
}

async function getLatestAssetBlock({ assetType, assetId, ownerUserId }, client = pool) {
  const result = await client.query(
    `SELECT id, block_index, asset_type, asset_id, owner_user_id, verification_code, payload_hash,
            previous_hash, block_hash, metadata, created_at
     FROM blockchain_blocks
     WHERE asset_type = $1 AND asset_id = $2 AND owner_user_id = $3
     ORDER BY block_index DESC
     LIMIT 1`,
    [assetType, assetId, ownerUserId]
  );

  return result.rows[0] || null;
}

async function createBlockchainBlock({
  assetType,
  assetId,
  ownerUserId,
  payload,
  metadata,
}, client = pool) {
  await client.query('LOCK TABLE blockchain_blocks IN EXCLUSIVE MODE');

  const latestBlockResult = await client.query(
    `SELECT block_index, block_hash
     FROM blockchain_blocks
     ORDER BY block_index DESC
     LIMIT 1`
  );

  const previousBlock = latestBlockResult.rows[0] || null;
  const blockIndex = previousBlock ? Number(previousBlock.block_index) + 1 : 1;
  const previousHash = previousBlock?.block_hash || null;
  const payloadHash = hashPayload(payload);

  let verificationCode = buildVerificationCode();
  let exists = true;

  while (exists) {
    const codeResult = await client.query(
      'SELECT id FROM blockchain_blocks WHERE verification_code = $1 LIMIT 1',
      [verificationCode]
    );
    exists = codeResult.rows.length > 0;
    if (exists) verificationCode = buildVerificationCode();
  }

  const blockHash = buildBlockHash({
    blockIndex,
    assetType,
    assetId,
    ownerUserId,
    verificationCode,
    payloadHash,
    previousHash,
    metadata,
  });

  const result = await client.query(
    `INSERT INTO blockchain_blocks (
       block_index, asset_type, asset_id, owner_user_id, verification_code,
       payload_hash, previous_hash, block_hash, metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING id, block_index, asset_type, asset_id, owner_user_id, verification_code,
               payload_hash, previous_hash, block_hash, metadata, created_at`,
    [
      blockIndex,
      assetType,
      assetId,
      ownerUserId,
      verificationCode,
      payloadHash,
      previousHash,
      blockHash,
      JSON.stringify(metadata || {}),
    ]
  );

  return result.rows[0];
}

function validateBlockchainRecord(block, previousBlock) {
  if (!block) {
    return { isBlockValid: false, isLinkedToPrevious: false };
  }

  const computedBlockHash = buildBlockHash({
    blockIndex: block.block_index,
    assetType: block.asset_type,
    assetId: block.asset_id,
    ownerUserId: block.owner_user_id,
    verificationCode: block.verification_code,
    payloadHash: block.payload_hash,
    previousHash: block.previous_hash,
    metadata: block.metadata,
  });

  const isBlockValid = computedBlockHash === block.block_hash;
  const isLinkedToPrevious = !block.previous_hash || previousBlock?.block_hash === block.previous_hash;

  return {
    computedBlockHash,
    isBlockValid,
    isLinkedToPrevious,
  };
}

module.exports = {
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
};
