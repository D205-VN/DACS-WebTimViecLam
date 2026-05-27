const AppError = require('../../core/errors/AppError');
const { ensureCvSchema } = require('../../models/cv/cv.model');
const {
  buildAssetMetadata,
  buildCertificatePayload,
  buildCvPayload,
  buildExplorerUrl,
  buildWorkHistoryPayload,
  createBlockchainBlock,
  ensureVerificationSchema,
  formatDateValue,
  getBlockchainConfig,
  getLatestAssetBlock,
  hashPayload,
  validateBlockchainRecord,
  verifyBlockAnchor,
} = require('../../models/verification/verification.model');
const repository = require('../../repositories/verification/verification.repository');

function assertSeeker(user) {
  if (user?.role_code !== 'seeker') {
    throw new AppError('Chỉ ứng viên mới có quyền truy cập tính năng blockchain verification', 403, 'SEEKER_ONLY');
  }
}

function parsePositiveId(value, message) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(message, 400, 'INVALID_ID');
  }
  return id;
}

function buildPublicVerificationUrl(verificationCode) {
  return `/verify/${verificationCode}`;
}

function buildAnchorData(block = {}) {
  const explorerTxUrl = getBlockchainConfig().explorerTxUrl;

  return {
    anchor_network: block.anchor_network || null,
    chain_id: block.chain_id || null,
    anchor_tx_hash: block.anchor_tx_hash || null,
    anchor_address: block.anchor_address || null,
    anchor_error: block.anchor_error || null,
    anchored_at: block.anchored_at || null,
    explorer_url: block.anchor_tx_hash ? buildExplorerUrl(block.anchor_tx_hash, explorerTxUrl) : null,
  };
}

function decorateVerifiedRow(row) {
  return {
    ...row,
    ...buildAnchorData(row),
    public_url: row.verification_code ? buildPublicVerificationUrl(row.verification_code) : null,
  };
}

function normalizeText(value) {
  return String(value || '').trim();
}

async function prepareSchemas({ includeCv = false } = {}) {
  if (includeCv) await ensureCvSchema();
  await ensureVerificationSchema();
}

async function getOverview(user) {
  assertSeeker(user);
  await prepareSchemas({ includeCv: true });

  const [cvs, certificates, workHistories] = await Promise.all([
    repository.findCvOverview(user.id),
    repository.findCertificates(user.id),
    repository.findWorkHistories(user.id),
  ]);

  return {
    data: {
      cvs: cvs.map(decorateVerifiedRow),
      certificates: certificates.map(decorateVerifiedRow),
      workHistories: workHistories.map(decorateVerifiedRow),
    },
  };
}

async function notarizeCv(user, rawCvId) {
  assertSeeker(user);
  const cvId = parsePositiveId(rawCvId, 'Mã CV không hợp lệ');
  await prepareSchemas({ includeCv: true });

  return repository.withTransaction(async (client) => {
    const cv = await repository.findCvForOwner(cvId, user.id, client);
    if (!cv) {
      throw new AppError('Không tìm thấy CV để xác thực blockchain', 404, 'CV_NOT_FOUND');
    }

    const payload = buildCvPayload(cv);
    const latestBlock = await getLatestAssetBlock({
      assetType: 'cv',
      assetId: cv.id,
      ownerUserId: user.id,
    }, client);
    const currentPayloadHash = hashPayload(payload);

    if (latestBlock && latestBlock.payload_hash === currentPayloadHash) {
      return {
        status: 200,
        body: {
          message: 'CV này đã được xác thực blockchain với nội dung hiện tại.',
          data: {
            verification_code: latestBlock.verification_code,
            block_hash: latestBlock.block_hash,
            payload_hash: latestBlock.payload_hash,
            ...buildAnchorData(latestBlock),
            notarized_at: latestBlock.created_at,
            public_url: buildPublicVerificationUrl(latestBlock.verification_code),
          },
        },
      };
    }

    const block = await createBlockchainBlock({
      assetType: 'cv',
      assetId: cv.id,
      ownerUserId: user.id,
      payload,
      metadata: buildAssetMetadata('cv', cv, cv.full_name),
    }, client);

    return {
      status: 201,
      body: {
        message: 'Đã ghi CV lên blockchain ledger nội bộ.',
        data: {
          verification_code: block.verification_code,
          block_hash: block.block_hash,
          payload_hash: block.payload_hash,
          ...buildAnchorData(block),
          notarized_at: block.created_at,
          public_url: buildPublicVerificationUrl(block.verification_code),
        },
      },
    };
  });
}

async function createCertificate(user, body = {}) {
  assertSeeker(user);
  await prepareSchemas();

  const certificateName = normalizeText(body.certificate_name);
  const issuerName = normalizeText(body.issuer_name);
  if (!certificateName || !issuerName) {
    throw new AppError('Tên chứng chỉ và đơn vị cấp là bắt buộc', 400, 'CERTIFICATE_REQUIRED_FIELDS');
  }

  return repository.withTransaction(async (client) => {
    const ownerName = await repository.getUserFullName(user.id, client);
    const certificate = await repository.insertCertificate(client, {
      userId: user.id,
      certificateName,
      issuerName,
      credentialId: normalizeText(body.credential_id) || null,
      issueDate: formatDateValue(body.issue_date),
      expiryDate: formatDateValue(body.expiry_date),
      documentUrl: normalizeText(body.document_url) || null,
      notes: normalizeText(body.notes) || null,
    });

    const block = await createBlockchainBlock({
      assetType: 'certificate',
      assetId: certificate.id,
      ownerUserId: user.id,
      payload: buildCertificatePayload(certificate),
      metadata: buildAssetMetadata('certificate', certificate, ownerName),
    }, client);

    const data = await repository.attachCertificateBlock(client, {
      certificateId: certificate.id,
      userId: user.id,
      blockId: block.id,
      verificationCode: block.verification_code,
    });

    return {
      message: 'Đã tạo chứng chỉ và ghi nhận lên blockchain ledger nội bộ.',
      data: {
        ...data,
        ...buildAnchorData(block),
        public_url: buildPublicVerificationUrl(block.verification_code),
      },
    };
  });
}

async function getCertificates(user) {
  assertSeeker(user);
  await prepareSchemas();
  return { data: (await repository.findCertificates(user.id)).map(decorateVerifiedRow) };
}

async function revokeCertificate(user, rawCertificateId) {
  assertSeeker(user);
  const certificateId = parsePositiveId(rawCertificateId, 'Mã chứng chỉ không hợp lệ');
  await prepareSchemas();

  const certificate = await repository.revokeCertificate(user.id, certificateId);
  if (!certificate) {
    throw new AppError('Không tìm thấy chứng chỉ để thu hồi', 404, 'CERTIFICATE_NOT_FOUND');
  }

  return {
    message: 'Chứng chỉ đã được đánh dấu thu hồi.',
    data: {
      ...certificate,
      public_url: certificate.verification_code ? buildPublicVerificationUrl(certificate.verification_code) : null,
    },
  };
}

async function createWorkHistory(user, body = {}) {
  assertSeeker(user);
  await prepareSchemas();

  const companyName = normalizeText(body.company_name);
  const jobTitle = normalizeText(body.job_title);
  if (!companyName || !jobTitle) {
    throw new AppError('Tên công ty và chức danh là bắt buộc', 400, 'WORK_HISTORY_REQUIRED_FIELDS');
  }

  return repository.withTransaction(async (client) => {
    const ownerName = await repository.getUserFullName(user.id, client);
    const workHistory = await repository.insertWorkHistory(client, {
      userId: user.id,
      companyName,
      jobTitle,
      employmentType: normalizeText(body.employment_type) || null,
      startDate: formatDateValue(body.start_date),
      endDate: body.currently_working ? null : formatDateValue(body.end_date),
      currentlyWorking: Boolean(body.currently_working),
      summary: normalizeText(body.summary) || null,
    });

    const block = await createBlockchainBlock({
      assetType: 'work_history',
      assetId: workHistory.id,
      ownerUserId: user.id,
      payload: buildWorkHistoryPayload(workHistory),
      metadata: buildAssetMetadata('work_history', workHistory, ownerName),
    }, client);

    const data = await repository.attachWorkHistoryBlock(client, {
      workHistoryId: workHistory.id,
      userId: user.id,
      blockId: block.id,
      verificationCode: block.verification_code,
    });

    return {
      message: 'Đã tạo lịch sử làm việc và ghi nhận lên blockchain ledger nội bộ.',
      data: {
        ...data,
        ...buildAnchorData(block),
        public_url: buildPublicVerificationUrl(block.verification_code),
      },
    };
  });
}

async function getWorkHistories(user) {
  assertSeeker(user);
  await prepareSchemas();
  return { data: (await repository.findWorkHistories(user.id)).map(decorateVerifiedRow) };
}

async function revokeWorkHistory(user, rawWorkHistoryId) {
  assertSeeker(user);
  const workHistoryId = parsePositiveId(rawWorkHistoryId, 'Mã lịch sử làm việc không hợp lệ');
  await prepareSchemas();

  const workHistory = await repository.revokeWorkHistory(user.id, workHistoryId);
  if (!workHistory) {
    throw new AppError('Không tìm thấy lịch sử làm việc để thu hồi', 404, 'WORK_HISTORY_NOT_FOUND');
  }

  return {
    message: 'Lịch sử làm việc đã được đánh dấu thu hồi.',
    data: {
      ...workHistory,
      public_url: workHistory.verification_code ? buildPublicVerificationUrl(workHistory.verification_code) : null,
    },
  };
}

async function resolvePublicAsset(block) {
  if (block.asset_type === 'cv') {
    const cv = await repository.findCvPublicAsset(block.asset_id);
    if (!cv) return { asset: { type: 'cv', status: 'source_deleted' }, currentPayloadHash: null };

    return {
      currentPayloadHash: hashPayload(buildCvPayload(cv)),
      asset: {
        type: 'cv',
        owner_name: cv.full_name,
        title: cv.title,
        target_role: cv.target_role,
        current_location: cv.current_location,
        created_at: cv.created_at,
        status: 'active',
      },
    };
  }

  if (block.asset_type === 'certificate') {
    const certificate = await repository.findCertificatePublicAsset(block.asset_id);
    if (!certificate) return { asset: { type: 'certificate', status: 'source_deleted' }, currentPayloadHash: null };

    return {
      currentPayloadHash: hashPayload(buildCertificatePayload(certificate)),
      asset: {
        type: 'certificate',
        owner_name: certificate.full_name,
        certificate_name: certificate.certificate_name,
        issuer_name: certificate.issuer_name,
        credential_id: certificate.credential_id,
        issue_date: certificate.issue_date,
        expiry_date: certificate.expiry_date,
        status: certificate.status,
      },
    };
  }

  const workHistory = await repository.findWorkHistoryPublicAsset(block.asset_id);
  if (!workHistory) return { asset: { type: 'work_history', status: 'source_deleted' }, currentPayloadHash: null };

  return {
    currentPayloadHash: hashPayload(buildWorkHistoryPayload(workHistory)),
    asset: {
      type: 'work_history',
      owner_name: workHistory.full_name,
      company_name: workHistory.company_name,
      job_title: workHistory.job_title,
      employment_type: workHistory.employment_type,
      start_date: workHistory.start_date,
      end_date: workHistory.end_date,
      currently_working: workHistory.currently_working,
      status: workHistory.status,
    },
  };
}

async function getPublicVerification(rawVerificationCode) {
  const verificationCode = normalizeText(rawVerificationCode).toUpperCase();
  if (!verificationCode) {
    throw new AppError('Mã xác thực không hợp lệ', 400, 'INVALID_VERIFICATION_CODE');
  }

  await prepareSchemas({ includeCv: true });

  const block = await repository.findBlockByVerificationCode(verificationCode);
  if (!block) {
    throw new AppError('Không tìm thấy mã xác thực blockchain', 404, 'VERIFICATION_NOT_FOUND');
  }

  const previousBlock = block.previous_hash
    ? await repository.findBlockByHash(block.previous_hash)
    : null;
  const chainValidation = validateBlockchainRecord(block, previousBlock);
  const { asset, currentPayloadHash } = await resolvePublicAsset(block);
  const latestVerification = await repository.findLatestBlockForAsset(block.asset_type, block.asset_id);

  let onChainAnchor = {
    checked: false,
    is_valid: false,
    error: 'Chưa có transaction on-chain để kiểm tra',
  };

  if (block.anchor_tx_hash) {
    try {
      onChainAnchor = await verifyBlockAnchor(block);
    } catch (err) {
      onChainAnchor = {
        checked: false,
        is_valid: false,
        error: err.message,
      };
    }
  }

  return {
    data: {
      verification_code: block.verification_code,
      block_index: block.block_index,
      asset_type: block.asset_type,
      verified_at: block.created_at,
      block_hash: block.block_hash,
      previous_hash: block.previous_hash,
      payload_hash: block.payload_hash,
      ...buildAnchorData(block),
      metadata: block.metadata || {},
      public_url: buildPublicVerificationUrl(block.verification_code),
      is_block_valid: chainValidation.isBlockValid,
      is_linked_to_previous: chainValidation.isLinkedToPrevious,
      is_on_chain_anchor_valid: onChainAnchor.is_valid,
      on_chain_anchor: onChainAnchor,
      is_latest_version: latestVerification?.verification_code === block.verification_code,
      matches_current_record: currentPayloadHash ? currentPayloadHash === block.payload_hash : false,
      asset,
    },
  };
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
