const { ethers } = require('ethers');

const DEFAULT_NETWORK_NAME = 'EVM';
const DEFAULT_CONFIRMATIONS = 1;

function isBlockchainEnabled() {
  return String(process.env.BLOCKCHAIN_ENABLED || '').toLowerCase() === 'true';
}

function isBlockchainRequired() {
  return String(process.env.BLOCKCHAIN_REQUIRED || '').toLowerCase() === 'true';
}

function getConfirmationCount() {
  const confirmations = Number(process.env.EVM_WAIT_CONFIRMATIONS);
  return Number.isInteger(confirmations) && confirmations >= 0
    ? confirmations
    : DEFAULT_CONFIRMATIONS;
}

function getBlockchainConfig() {
  return {
    enabled: isBlockchainEnabled(),
    required: isBlockchainRequired(),
    rpcUrl: process.env.EVM_RPC_URL,
    privateKey: process.env.EVM_PRIVATE_KEY,
    chainId: process.env.EVM_CHAIN_ID ? Number(process.env.EVM_CHAIN_ID) : null,
    networkName: process.env.EVM_NETWORK_NAME || DEFAULT_NETWORK_NAME,
    anchorAddress: process.env.EVM_ANCHOR_ADDRESS,
    explorerTxUrl: process.env.EVM_EXPLORER_TX_URL || '',
    confirmations: getConfirmationCount(),
  };
}

function assertConfig(config) {
  if (!config.enabled) {
    throw new Error('Blockchain anchoring chưa được bật');
  }

  if (!config.rpcUrl || !config.privateKey) {
    throw new Error('Thiếu EVM_RPC_URL hoặc EVM_PRIVATE_KEY để ghi lên blockchain thật');
  }
}

function buildAnchorPayload(block) {
  return {
    app: 'AptertekWork.vn',
    purpose: 'verification_anchor',
    block_index: block.block_index,
    asset_type: block.asset_type,
    asset_id: block.asset_id,
    owner_user_id: block.owner_user_id,
    verification_code: block.verification_code,
    payload_hash: block.payload_hash,
    block_hash: block.block_hash,
    previous_hash: block.previous_hash || null,
  };
}

function buildExplorerUrl(txHash, explorerTxUrl = '') {
  if (!txHash || !explorerTxUrl) return null;
  return `${explorerTxUrl.replace(/\/$/, '')}/${txHash}`;
}

function buildProvider(config) {
  return new ethers.JsonRpcProvider(
    config.rpcUrl,
    config.chainId ? { chainId: config.chainId, name: config.networkName } : undefined
  );
}

async function anchorBlockOnChain(block) {
  const config = getBlockchainConfig();
  assertConfig(config);

  const provider = buildProvider(config);
  const wallet = new ethers.Wallet(config.privateKey, provider);
  const to = config.anchorAddress || wallet.address;
  const anchorPayload = buildAnchorPayload(block);
  const data = ethers.hexlify(ethers.toUtf8Bytes(JSON.stringify(anchorPayload)));

  const tx = await wallet.sendTransaction({
    to,
    value: 0,
    data,
  });

  const receipt = config.confirmations > 0
    ? await tx.wait(config.confirmations)
    : null;
  const network = await provider.getNetwork();
  const txHash = receipt?.hash || tx.hash;
  const chainId = Number(network.chainId);

  return {
    network: config.networkName,
    chain_id: chainId,
    tx_hash: txHash,
    anchor_address: to,
    explorer_url: buildExplorerUrl(txHash, config.explorerTxUrl),
  };
}

async function verifyBlockAnchor(block) {
  const config = getBlockchainConfig();
  if (!block?.anchor_tx_hash || !config.rpcUrl) {
    return {
      checked: false,
      is_valid: false,
      error: 'Thiếu tx hash hoặc EVM_RPC_URL để kiểm tra on-chain',
    };
  }

  const provider = buildProvider(config);
  const tx = await provider.getTransaction(block.anchor_tx_hash);
  if (!tx) {
    return {
      checked: true,
      is_valid: false,
      error: 'Không tìm thấy transaction trên RPC hiện tại',
    };
  }

  const expectedData = ethers.hexlify(ethers.toUtf8Bytes(JSON.stringify(buildAnchorPayload(block))));
  const matchesData = String(tx.data || '').toLowerCase() === expectedData.toLowerCase();
  const matchesAddress = block.anchor_address
    ? String(tx.to || '').toLowerCase() === String(block.anchor_address).toLowerCase()
    : true;

  return {
    checked: true,
    is_valid: matchesData && matchesAddress,
    tx_hash: tx.hash,
    tx_to: tx.to,
    block_number: tx.blockNumber || null,
    matches_data: matchesData,
    matches_address: matchesAddress,
  };
}

module.exports = {
  anchorBlockOnChain,
  buildExplorerUrl,
  getBlockchainConfig,
  isBlockchainEnabled,
  isBlockchainRequired,
  verifyBlockAnchor,
};
