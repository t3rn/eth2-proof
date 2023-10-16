"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = exports.calculateTransactionProof = exports.calculateReceiptProof = exports.getBlock = exports.generateTransactionProof = exports.generateStateProof = exports.encodeTxAsValidRLP = exports.generateTxReceiptProof = exports.setupEthRPCClient = exports.receiptToRlp = exports.encode = void 0;
const merkle_patricia_tree_1 = require("merkle-patricia-tree");
const utils = __importStar(require("web3-utils"));
const web3_1 = __importDefault(require("web3"));
const web3_eth_accounts_1 = require("web3-eth-accounts");
const rlp_1 = __importDefault(require("rlp"));
const encode = (input) => input === '0xs0' ? rlp_1.default.encode(Buffer.alloc(0)) : rlp_1.default.encode(input);
exports.encode = encode;
const receiptToRlp = (receipt) => {
    let encodedLegacy = rlp_1.default.encode([
        receipt.status ? '0x1' : '0x',
        receipt.cumulativeGasUsed > 0
            ? utils.toHex(receipt.cumulativeGasUsed)
            : '0x',
        receipt.logsBloom,
        receipt.logs.map((log) => [log.address, log.topics, log.data]),
    ]);
    if (!!receipt.type && receipt.type !== '0x0') {
        const transactionType = parseInt(receipt.type.toString());
        const concat = new Uint8Array(encodedLegacy.byteLength + 1);
        const version = new Uint8Array([transactionType]);
        concat.set(version, 0);
        concat.set(new Uint8Array(encodedLegacy), 1);
        return concat;
    }
    return encodedLegacy;
};
exports.receiptToRlp = receiptToRlp;
const setupEthRPCClient = (rpcUrl = 'https://sepolia.infura.io/v3/ee1e6d7e77c2415386766fa559769941') => {
    return new web3_1.default(rpcUrl);
};
exports.setupEthRPCClient = setupEthRPCClient;
const generateTxReceiptProof = (txId, instance) => __awaiter(void 0, void 0, void 0, function* () {
    // assume event attached will be taken from index = 0 if exists
    const eventIndex = 0;
    const receipt = yield instance.eth.getTransactionReceipt(txId);
    console.log('⬅️found receipt for tx: ', txId);
    console.log('🔃parsed receipt to hex form'); // console.log if u will (seems too long to show in command line output) utils.toHex(receiptToRlp(receipt))
    const block = yield instance.eth.getBlock(receipt.blockHash);
    console.log('⬅️found block for receipt: ', block.hash, block.number);
    let siblings = yield Promise.all(
    // @ts-ignore
    block.transactions.map((txId) => __awaiter(void 0, void 0, void 0, function* () {
        let sibling = yield instance.eth.getTransactionReceipt(txId);
        return sibling;
    })));
    console.log(`⬅️fetched all ${siblings.length} sibling transaction receipts`);
    const proofOutput = yield (0, exports.calculateReceiptProof)(siblings, receipt.transactionIndex);
    console.log(receipt.logs);
    const event0 = receipt.logs[eventIndex];
    const eventAsUint8Array = !!event0
        ? (0, exports.encode)([event0.address, event0.topics, event0.data])
        : Uint8Array.from([]);
    const proofOutputHex = {
        proof: proofOutput.proof.map((node) => node.toString('hex')),
        root: proofOutput.root.toString('hex'),
        index: (0, exports.encode)(receipt.transactionIndex),
        value: proofOutput.value.toString('hex'),
        event: Buffer.from(eventAsUint8Array).toString('hex'),
    };
    // console.log("🧮generated proof for tx: ", proofOutputHex.proof);
    console.log('🧮proof-calculated receipts root vs block receipts root: ', '0x' + proofOutputHex.root, block.receiptsRoot);
    return proofOutputHex;
});
exports.generateTxReceiptProof = generateTxReceiptProof;
// The IPLD block is the consensus encoding of the transaction:
// Legacy transaction encoding: RLP([AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, V, R, S]).
// The V, R, S elements of this transaction either represent a secp256k1 signature over KECCAK_256(RLP([AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data])) OR over KECCAK_256(RLP([AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, ChainID, 0, 0])) as described by EIP-155.
// Access list (EIP-2930) transaction encoding: 0x01 || RLP([ChainID, AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, AccessList, V, R, S].
// The V, R, S elements of this transaction represent a secp256k1 signature over KECCAK_256(0x01 || RLP([ChainID, AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, AccessList]).
// || is the byte/byte-array concatenation operator.
// Dynamic fee (EIP-1559) transaction encoding: 0x02 || RLP([ChainID, AccountNonce, GasTipCap, maxFeePerGas, GasFeeCap, Recipient, Amount, Data, AccessList, V, R, S]
// The V, R, S elements of this transaction represent a secp256k1 signature over KECCAK_256(0x02 || RLP([ChainID, AccountNonce, GasTipCap, maxFeePerGas, GasFeeCap, Recipient, Amount, Data, AccessList]
const encodeTxAsValidRLP = (transactionRPC) => {
    if (transactionRPC.type == 0 || transactionRPC.type === undefined) {
        // Legacy transaction encoding: RLP([AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, V, R, S]).
        // The V, R, S elements of this transaction either represent a secp256k1 signature over KECCAK_256(RLP([AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data])) OR over KECCAK_256(RLP([AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, ChainID, 0, 0])) as described by EIP-155.
        let legacyTransactionEncoded = (0, exports.encode)([
            transactionRPC.nonce,
            transactionRPC.gasPrice,
            transactionRPC.gas,
            transactionRPC.to || undefined,
            transactionRPC.value,
            transactionRPC.input,
            transactionRPC.v,
            transactionRPC.r,
            transactionRPC.s,
        ]);
        return Buffer.from(legacyTransactionEncoded);
    }
    else if (transactionRPC.type == 1) {
        // Access list (EIP-2930) transaction encoding: 0x01 || RLP([ChainID, AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, AccessList, V, R, S].
        // The V, R, S elements of this transaction represent a secp256k1 signature over KECCAK_256(0x01 || RLP([ChainID, AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, AccessList]).
        // || is the byte/byte-array concatenation operator.
        let accessListTransactionEncoded = (0, exports.encode)([
            transactionRPC.chainId,
            transactionRPC.nonce,
            transactionRPC.gasPrice,
            transactionRPC.gas,
            transactionRPC.to || undefined,
            transactionRPC.value,
            transactionRPC.input,
            transactionRPC.accessList,
            transactionRPC.v,
            transactionRPC.r,
            transactionRPC.s,
        ]);
        const TRANSACTION_TYPE = 1;
        const TRANSACTION_TYPE_BUFFER = Buffer.from(TRANSACTION_TYPE.toString(16).padStart(2, '0'), 'hex');
        return Buffer.concat([
            TRANSACTION_TYPE_BUFFER,
            accessListTransactionEncoded,
        ]);
    }
    else if (transactionRPC.type == 2) {
        // Dynamic fee (EIP-1559) transaction encoding: 0x02 || RLP([ChainID, AccountNonce, GasTipCap, maxFeePerGas, GasFeeCap, Recipient, Amount, Data, AccessList, V, R, S]
        // The V, R, S elements of this transaction represent a secp256k1 signature over KECCAK_256(0x02 || RLP([ChainID, AccountNonce, GasTipCap, maxFeePerGas, GasFeeCap, Recipient, Amount, Data, AccessList]
        let eip1559TransactionEncoded = (0, exports.encode)([
            transactionRPC.chainId,
            transactionRPC.nonce,
            transactionRPC.maxPriorityFeePerGas,
            transactionRPC.maxFeePerGas,
            transactionRPC.gas,
            transactionRPC.to || undefined,
            transactionRPC.value,
            transactionRPC.input,
            transactionRPC.accessList,
            transactionRPC.v,
            transactionRPC.r,
            transactionRPC.s,
        ]);
        const TRANSACTION_TYPE = 2;
        const TRANSACTION_TYPE_BUFFER = Buffer.from(TRANSACTION_TYPE.toString(16).padStart(2, '0'), 'hex');
        return Buffer.concat([TRANSACTION_TYPE_BUFFER, eip1559TransactionEncoded]);
    }
    return Buffer.from([]);
};
exports.encodeTxAsValidRLP = encodeTxAsValidRLP;
const generateStateProof = (accountId, storageId, blockNumber, instance) => __awaiter(void 0, void 0, void 0, function* () {
    // Get the state root hash
    const block = yield instance.eth.getBlock(blockNumber);
    const blockHash = block.hash;
    console.log('⬅️found block matching block number: ', blockNumber, blockHash);
    console.log(`🔃block's state_root = ${block.stateRoot}`);
    let rpcProof = yield instance.eth.getProof(accountId, [storageId], blockNumber);
    // @ts-ignore
    rpcProof.blockStateRoot = block.stateRoot;
    return rpcProof;
});
exports.generateStateProof = generateStateProof;
const generateTransactionProof = (txId, instance) => __awaiter(void 0, void 0, void 0, function* () {
    const transactionRPC = yield instance.eth.getTransaction(txId);
    console.log('⬅️found transaction matching ID: ', txId);
    const typedTransaction = web3_eth_accounts_1.TransactionFactory.fromTxData({
        nonce: transactionRPC.nonce,
        gasPrice: transactionRPC.gasPrice,
        gasLimit: transactionRPC.gas,
        to: transactionRPC.to || undefined,
        value: transactionRPC.value,
        data: transactionRPC.input,
        v: transactionRPC.v,
        r: transactionRPC.r,
        s: transactionRPC.s,
        type: transactionRPC.type,
    });
    console.log('🔃serialized transaction to RLP form'); // console.log if u will (seems too long to show in command line output) utils.toHex(typedTransaction.serialize())
    const block = yield instance.eth.getBlock(transactionRPC.blockHash);
    console.log('⬅️found block for receipt: ', block.hash, block.number);
    let siblings = yield Promise.all(
    // @ts-ignore
    block.transactions.map((txId) => __awaiter(void 0, void 0, void 0, function* () {
        let sibling = yield instance.eth.getTransaction(txId);
        return sibling;
    })));
    console.log(`⬅️fetched all ${siblings.length} sibling transactions`);
    let proofOutput = yield (0, exports.calculateTransactionProof)(siblings, transactionRPC.transactionIndex);
    const proofOutputHex = {
        proof: proofOutput.proof.map((node) => node.toString('hex')),
        root: proofOutput.root.toString('hex'),
        index: (0, exports.encode)(transactionRPC.transactionIndex),
        value: proofOutput.value.toString('hex'),
    };
    console.log('🧮proof-calculated transactions root vs block transactions root: ', '0x' + proofOutputHex.root, block.transactionsRoot);
    return proofOutputHex;
});
exports.generateTransactionProof = generateTransactionProof;
const getBlock = (blockId, instance) => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, exports.sleep)(2000); // need to wait for RPC to by synced
    const block = yield instance.eth.getBlock(blockId).catch((err) => {
        console.log('errrrr');
        console.log(err);
    });
    return block;
});
exports.getBlock = getBlock;
const calculateReceiptProof = (receipts, index) => __awaiter(void 0, void 0, void 0, function* () {
    let trie = new merkle_patricia_tree_1.BaseTrie();
    for (let i = 0; i < receipts.length; i++) {
        const entry = receipts[i];
        const keyAsRlpEncodedTxIndex = (0, exports.encode)(entry.transactionIndex);
        const valueAsRlpEncodedReceipt = (0, exports.receiptToRlp)(entry);
        yield trie.put(Buffer.from(keyAsRlpEncodedTxIndex), Buffer.from(valueAsRlpEncodedReceipt));
    }
    const proof = yield merkle_patricia_tree_1.BaseTrie.createProof(trie, Buffer.from((0, exports.encode)(index)));
    console.log('Computed Root: ', trie.root.toString('hex'));
    const verifyResult = yield merkle_patricia_tree_1.BaseTrie.verifyProof(trie.root, Buffer.from((0, exports.encode)(index)), proof);
    if (verifyResult === null) {
        throw new Error('Proof is invalid');
    }
    const value = verifyResult;
    return {
        proof,
        root: trie.root,
        value,
    };
});
exports.calculateReceiptProof = calculateReceiptProof;
const calculateTransactionProof = (transactions, index) => __awaiter(void 0, void 0, void 0, function* () {
    let trie = new merkle_patricia_tree_1.BaseTrie();
    for (let i = 0; i < transactions.length; i++) {
        const entry = transactions[i];
        const keyAsRlpEncodedTxIndex = (0, exports.encode)(entry.transactionIndex);
        const valueAsRlpEncodedTransaction = (0, exports.encodeTxAsValidRLP)(entry);
        yield trie.put(Buffer.from(keyAsRlpEncodedTxIndex), Buffer.from(valueAsRlpEncodedTransaction));
    }
    const proof = yield merkle_patricia_tree_1.BaseTrie.createProof(trie, Buffer.from((0, exports.encode)(index)));
    const verifyResult = yield merkle_patricia_tree_1.BaseTrie.verifyProof(trie.root, Buffer.from((0, exports.encode)(index)), proof);
    if (verifyResult === null) {
        throw new Error('💣💣💣 Proof is invalid 💣💣💣');
    }
    const value = verifyResult;
    return {
        proof,
        root: trie.root,
        value,
    };
});
exports.calculateTransactionProof = calculateTransactionProof;
const sleep = (time) => __awaiter(void 0, void 0, void 0, function* () {
    return new Promise((resolve) => setTimeout(resolve, time));
});
exports.sleep = sleep;
