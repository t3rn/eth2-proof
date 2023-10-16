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
exports.ProofGenerator = void 0;
const rlp_1 = __importDefault(require("rlp"));
const merkle_patricia_tree_1 = require("merkle-patricia-tree");
const web3_1 = __importDefault(require("web3"));
const web3_eth_accounts_1 = require("web3-eth-accounts");
const utils = __importStar(require("web3-utils"));
const helpers_1 = require("./helpers");
class ProofGenerator {
    constructor(rpcUrl) {
        this.web3 = new web3_1.default(rpcUrl);
    }
    static encode(input) {
        return input === '0xs0' ? rlp_1.default.encode(Buffer.alloc(0)) : rlp_1.default.encode(input);
    }
    static receiptToRlp(receipt) {
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
    }
    generateTxReceiptProof(txId) {
        return __awaiter(this, void 0, void 0, function* () {
            // assume event attached will be taken from index = 0 if exists
            const eventIndex = 0;
            const receipt = yield this.web3.eth.getTransactionReceipt(txId);
            console.log('⬅️found receipt for tx: ', txId);
            console.log('🔃parsed receipt to hex form'); // console.log if u will (seems too long to show in command line output) utils.toHex(receiptToRlp(receipt))
            const block = yield this.web3.eth.getBlock(receipt.blockHash);
            console.log('⬅️found block for receipt: ', block.hash, block.number);
            let siblings = yield Promise.all(
            // @ts-ignore
            block.transactions.map((txId) => __awaiter(this, void 0, void 0, function* () {
                let sibling = yield this.web3.eth.getTransactionReceipt(txId);
                return sibling;
            })));
            console.log(`⬅️fetched all ${siblings.length} sibling transaction receipts`);
            const proofOutput = yield ProofGenerator.calculateReceiptProof(siblings, receipt.transactionIndex);
            console.log(receipt.logs);
            const event0 = receipt.logs[eventIndex];
            const eventAsUint8Array = !!event0
                ? ProofGenerator.encode([event0.address, event0.topics, event0.data])
                : Uint8Array.from([]);
            const proofOutputHex = {
                proof: proofOutput.proof.map((node) => node.toString('hex')),
                root: proofOutput.root.toString('hex'),
                index: ProofGenerator.encode(receipt.transactionIndex),
                value: proofOutput.value.toString('hex'),
                event: Buffer.from(eventAsUint8Array).toString('hex'),
            };
            // console.log("🧮generated proof for tx: ", proofOutputHex.proof);
            console.log('🧮proof-calculated receipts root vs block receipts root: ', '0x' + proofOutputHex.root, block.receiptsRoot);
            return proofOutputHex;
        });
    }
    /**
     * The IPLD block is the consensus encoding of the transaction:
     * Legacy transaction encoding: RLP([AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, V, R, S]).
     * The V, R, S elements of this transaction either represent a secp256k1 signature over KECCAK_256(RLP([AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data])) OR over KECCAK_256(RLP([AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, ChainID, 0, 0])) as described by EIP-155.
     * Access list (EIP-2930) transaction encoding: 0x01 || RLP([ChainID, AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, AccessList, V, R, S].
     * The V, R, S elements of this transaction represent a secp256k1 signature over KECCAK_256(0x01 || RLP([ChainID, AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, AccessList]).
     * || is the byte/byte-array concatenation operator.
     * Dynamic fee (EIP-1559) transaction encoding: 0x02 || RLP([ChainID, AccountNonce, GasTipCap, maxFeePerGas, GasFeeCap, Recipient, Amount, Data, AccessList, V, R, S]
     * The V, R, S elements of this transaction represent a secp256k1 signature over KECCAK_256(0x02 || RLP([ChainID, AccountNonce, GasTipCap, maxFeePerGas, GasFeeCap, Recipient, Amount, Data, AccessList]
     */
    static encodeTxAsValidRLP(tx) {
        if (tx.type == 0 || tx.type === undefined) {
            // Legacy transaction encoding: RLP([AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, V, R, S]).
            // The V, R, S elements of this transaction either represent a secp256k1 signature over KECCAK_256(RLP([AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data])) OR over KECCAK_256(RLP([AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, ChainID, 0, 0])) as described by EIP-155.
            let legacyTransactionEncoded = ProofGenerator.encode([
                tx.nonce,
                tx.gasPrice,
                tx.gas,
                tx.to || undefined,
                tx.value,
                tx.input,
                tx.v,
                tx.r,
                tx.s,
            ]);
            return Buffer.from(legacyTransactionEncoded);
        }
        else if (tx.type == 1) {
            // Access list (EIP-2930) transaction encoding: 0x01 || RLP([ChainID, AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, AccessList, V, R, S].
            // The V, R, S elements of this transaction represent a secp256k1 signature over KECCAK_256(0x01 || RLP([ChainID, AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, AccessList]).
            // || is the byte/byte-array concatenation operator.
            let accessListTransactionEncoded = ProofGenerator.encode([
                tx.chainId,
                tx.nonce,
                tx.gasPrice,
                tx.gas,
                tx.to || undefined,
                tx.value,
                tx.input,
                tx.accessList,
                tx.v,
                tx.r,
                tx.s,
            ]);
            const TRANSACTION_TYPE = 1;
            const TRANSACTION_TYPE_BUFFER = Buffer.from(TRANSACTION_TYPE.toString(16).padStart(2, '0'), 'hex');
            return Buffer.concat([
                TRANSACTION_TYPE_BUFFER,
                accessListTransactionEncoded,
            ]);
        }
        else if (tx.type == 2) {
            // Dynamic fee (EIP-1559) transaction encoding: 0x02 || RLP([ChainID, AccountNonce, GasTipCap, maxFeePerGas, GasFeeCap, Recipient, Amount, Data, AccessList, V, R, S]
            // The V, R, S elements of this transaction represent a secp256k1 signature over KECCAK_256(0x02 || RLP([ChainID, AccountNonce, GasTipCap, maxFeePerGas, GasFeeCap, Recipient, Amount, Data, AccessList]
            let eip1559TransactionEncoded = ProofGenerator.encode([
                tx.chainId,
                tx.nonce,
                tx.maxPriorityFeePerGas,
                tx.maxFeePerGas,
                tx.gas,
                tx.to || undefined,
                tx.value,
                tx.input,
                tx.accessList,
                tx.v,
                tx.r,
                tx.s,
            ]);
            const TRANSACTION_TYPE = 2;
            const TRANSACTION_TYPE_BUFFER = Buffer.from(TRANSACTION_TYPE.toString(16).padStart(2, '0'), 'hex');
            return Buffer.concat([TRANSACTION_TYPE_BUFFER, eip1559TransactionEncoded]);
        }
        return Buffer.from([]);
    }
    generateStateProof(accountId, storageId, blockNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get the state root hash
            const block = yield this.web3.eth.getBlock(blockNumber);
            const blockHash = block.hash;
            console.log('⬅️found block matching block number: ', blockNumber, blockHash);
            console.log(`🔃block's state_root = ${block.stateRoot}`);
            let rpcProof = yield this.web3.eth.getProof(accountId, [storageId], blockNumber);
            // @ts-ignore
            rpcProof.blockStateRoot = block.stateRoot;
            return rpcProof;
        });
    }
    generateTransactionProof(txId) {
        return __awaiter(this, void 0, void 0, function* () {
            const tx = yield this.web3.eth.getTransaction(txId);
            console.log('⬅️found transaction matching ID: ', txId);
            const typedTransaction = web3_eth_accounts_1.TransactionFactory.fromTxData({
                nonce: tx.nonce,
                gasPrice: tx.gasPrice,
                gasLimit: tx.gas,
                to: tx.to || undefined,
                value: tx.value,
                data: tx.input,
                v: tx.v,
                r: tx.r,
                s: tx.s,
                type: tx.type,
            });
            console.log('🔃serialized transaction to RLP form'); // console.log if u will (seems too long to show in command line output) utils.toHex(typedTransaction.serialize())
            const block = yield this.web3.eth.getBlock(tx.blockHash);
            console.log('⬅️found block for receipt: ', block.hash, block.number);
            let siblings = yield Promise.all(
            // @ts-ignore
            block.transactions.map((txId) => __awaiter(this, void 0, void 0, function* () {
                let sibling = yield this.web3.eth.getTransaction(txId);
                return sibling;
            })));
            console.log(`⬅️fetched all ${siblings.length} sibling transactions`);
            let proofOutput = yield ProofGenerator.calculateTransactionProof(siblings, tx.transactionIndex);
            const proofOutputHex = {
                proof: proofOutput.proof.map((node) => node.toString('hex')),
                root: proofOutput.root.toString('hex'),
                index: ProofGenerator.encode(tx.transactionIndex),
                value: proofOutput.value.toString('hex'),
            };
            console.log('🧮proof-calculated transactions root vs block transactions root: ', '0x' + proofOutputHex.root, block.transactionsRoot);
            return proofOutputHex;
        });
    }
    getBlock(blockId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield (0, helpers_1.sleep)(2); // need to wait for RPC to by synced
            const block = yield this.web3.eth.getBlock(blockId).catch((err) => {
                console.log('errrrr');
                console.log(err);
            });
            return block;
        });
    }
    static calculateReceiptProof(receipts, index) {
        return __awaiter(this, void 0, void 0, function* () {
            let trie = new merkle_patricia_tree_1.BaseTrie();
            for (let i = 0; i < receipts.length; i++) {
                const entry = receipts[i];
                const keyAsRlpEncodedTxIndex = ProofGenerator.encode(entry.transactionIndex);
                const valueAsRlpEncodedReceipt = ProofGenerator.receiptToRlp(entry);
                yield trie.put(Buffer.from(keyAsRlpEncodedTxIndex), Buffer.from(valueAsRlpEncodedReceipt));
            }
            const proof = yield merkle_patricia_tree_1.BaseTrie.createProof(trie, Buffer.from(ProofGenerator.encode(index)));
            console.log('Computed Root: ', trie.root.toString('hex'));
            const verifyResult = yield merkle_patricia_tree_1.BaseTrie.verifyProof(trie.root, Buffer.from(ProofGenerator.encode(index)), proof);
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
    }
    static calculateTransactionProof(transactions, index) {
        return __awaiter(this, void 0, void 0, function* () {
            let trie = new merkle_patricia_tree_1.BaseTrie();
            for (let i = 0; i < transactions.length; i++) {
                const entry = transactions[i];
                const keyAsRlpEncodedTxIndex = ProofGenerator.encode(entry.transactionIndex);
                const valueAsRlpEncodedTransaction = ProofGenerator.encodeTxAsValidRLP(entry);
                yield trie.put(Buffer.from(keyAsRlpEncodedTxIndex), Buffer.from(valueAsRlpEncodedTransaction));
            }
            const proof = yield merkle_patricia_tree_1.BaseTrie.createProof(trie, Buffer.from(ProofGenerator.encode(index)));
            const verifyResult = yield merkle_patricia_tree_1.BaseTrie.verifyProof(trie.root, Buffer.from(ProofGenerator.encode(index)), proof);
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
    }
}
exports.ProofGenerator = ProofGenerator;
//# sourceMappingURL=proof-generator.js.map