import { BaseTrie as Trie } from "merkle-patricia-tree";
import * as utils from "web3-utils";

import Web3, {
  Bytes,
  TransactionReceipt,
} from "web3";
import {
  TypedTransaction,
  TransactionFactory,
} from "web3-eth-accounts";

import RLP from "rlp";
import {
  HexString32Bytes,
  TransactionInfo,
} from "web3-types";

export const encode = (input: any) =>
  input === "0xs0" ? RLP.encode(Buffer.alloc(0)) : RLP.encode(input);

export const receiptToRlp = (receipt: TransactionReceipt): Uint8Array => {
  let encodedLegacy = RLP.encode([
    receipt.status ? "0x1" : "0x",
    (receipt.cumulativeGasUsed as number) > 0
      ? utils.toHex(receipt.cumulativeGasUsed)
      : "0x",
    receipt.logsBloom,
    receipt.logs.map((log: any) => [log.address, log.topics, log.data]),
  ]);

  if (!!receipt.type && receipt.type !== "0x0") {
    const transactionType = parseInt(receipt.type.toString());
    const concat = new Uint8Array(encodedLegacy.byteLength + 1);
    const version = new Uint8Array([transactionType]);
    concat.set(version, 0);
    concat.set(new Uint8Array(encodedLegacy), 1);
    return concat;
  }

  return encodedLegacy;
};

export const setupEthRPCClient = (
  rpcUrl: string = "https://docs-demo.quiknode.pro/"
) => {
  return new Web3(rpcUrl);
};

export const generateTxReceiptProof = async (
  txId: string,
  instance: Web3
): Promise<{ proof: string[]; root: string; value: string }> => {
  const receipt: TransactionReceipt = await instance.eth.getTransactionReceipt(
    txId
  );

  console.log("⬅️found receipt for tx: ", txId);
  console.log("🔃parsed receipt to hex form"); // console.log if u will (seems too long to show in command line output) utils.toHex(receiptToRlp(receipt))
  const block = await instance.eth.getBlock(
    receipt.blockHash as HexString32Bytes
  );
  console.log("⬅️found block for receipt: ", block.hash, block.number);

  let siblings: TransactionReceipt[] = await Promise.all(
    // @ts-ignore
    block.transactions.map(async (txId: string) => {
      let sibling: TransactionReceipt =
        await instance.eth.getTransactionReceipt(txId);
      return sibling;
    })
  );
  console.log(`⬅️fetched all ${siblings.length} sibling transaction receipts`);
  const proofOutput = await calculateReceiptProof(
    siblings,
    receipt.transactionIndex as number
  );
  const proofOutputHex = {
    proof: proofOutput.proof.map((node: Buffer) => node.toString("hex")),
    root: proofOutput.root.toString("hex"),
    index: encode(receipt.transactionIndex as number),
    value: proofOutput.value.toString("hex"),
  };
  // console.log("🧮generated proof for tx: ", proofOutputHex.proof);
  console.log(
    "🧮proof-calculated receipts root vs block receipts root: ",
    "0x" + proofOutputHex.root,
    block.receiptsRoot
  );

  return proofOutputHex;
};

// The IPLD block is the consensus encoding of the transaction:
// Legacy transaction encoding: RLP([AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, V, R, S]).
// The V, R, S elements of this transaction either represent a secp256k1 signature over KECCAK_256(RLP([AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data])) OR over KECCAK_256(RLP([AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, ChainID, 0, 0])) as described by EIP-155.
// Access list (EIP-2930) transaction encoding: 0x01 || RLP([ChainID, AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, AccessList, V, R, S].
// The V, R, S elements of this transaction represent a secp256k1 signature over KECCAK_256(0x01 || RLP([ChainID, AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, AccessList]).
// || is the byte/byte-array concatenation operator.
// Dynamic fee (EIP-1559) transaction encoding: 0x02 || RLP([ChainID, AccountNonce, GasTipCap, maxFeePerGas, GasFeeCap, Recipient, Amount, Data, AccessList, V, R, S]
// The V, R, S elements of this transaction represent a secp256k1 signature over KECCAK_256(0x02 || RLP([ChainID, AccountNonce, GasTipCap, maxFeePerGas, GasFeeCap, Recipient, Amount, Data, AccessList]
export const encodeTxAsValidRLP = (transactionRPC: TransactionInfo): Buffer => {
  if (transactionRPC.type == 0 || transactionRPC.type === undefined) {
    // Legacy transaction encoding: RLP([AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, V, R, S]).
    // The V, R, S elements of this transaction either represent a secp256k1 signature over KECCAK_256(RLP([AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data])) OR over KECCAK_256(RLP([AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, ChainID, 0, 0])) as described by EIP-155.
    let legacyTransactionEncoded: Uint8Array = encode([
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
  } else if (transactionRPC.type == 1) {
    // Access list (EIP-2930) transaction encoding: 0x01 || RLP([ChainID, AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, AccessList, V, R, S].
    // The V, R, S elements of this transaction represent a secp256k1 signature over KECCAK_256(0x01 || RLP([ChainID, AccountNonce, GasPrice, GasLimit, Recipient, Amount, Data, AccessList]).
    // || is the byte/byte-array concatenation operator.
    let accessListTransactionEncoded: Uint8Array = encode([
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
    const TRANSACTION_TYPE_BUFFER = Buffer.from(
      TRANSACTION_TYPE.toString(16).padStart(2, "0"),
      "hex"
    );

    return Buffer.concat([
      TRANSACTION_TYPE_BUFFER,
      accessListTransactionEncoded,
    ]);
  } else if (transactionRPC.type == 2) {
    // Dynamic fee (EIP-1559) transaction encoding: 0x02 || RLP([ChainID, AccountNonce, GasTipCap, maxFeePerGas, GasFeeCap, Recipient, Amount, Data, AccessList, V, R, S]
    // The V, R, S elements of this transaction represent a secp256k1 signature over KECCAK_256(0x02 || RLP([ChainID, AccountNonce, GasTipCap, maxFeePerGas, GasFeeCap, Recipient, Amount, Data, AccessList]
    let eip1559TransactionEncoded: Uint8Array = encode([
      transactionRPC.chainId,
      transactionRPC.nonce,
      transactionRPC.maxPriorityFeePerGas,
      transactionRPC.maxFeePerGas,
      transactionRPC.gas, // gasFeeCap
      transactionRPC.to || undefined,
      transactionRPC.value,
      transactionRPC.input,
      transactionRPC.accessList,
      transactionRPC.v,
      transactionRPC.r,
      transactionRPC.s,
    ]);

    const TRANSACTION_TYPE = 2;
    const TRANSACTION_TYPE_BUFFER = Buffer.from(
      TRANSACTION_TYPE.toString(16).padStart(2, "0"),
      "hex"
    );

    return Buffer.concat([TRANSACTION_TYPE_BUFFER, eip1559TransactionEncoded]);
  }

  return Buffer.from([]);
};
export const generateStateProof = async (
  accountId: string,
  storageId: string,
  blockNumber: number | string,
  instance: Web3
) => {
  // Get the state root hash
  const block = await instance.eth.getBlock(blockNumber);
  const blockHash = block.hash;

  console.log("⬅️found block matching block number: ", blockNumber, blockHash);
  console.log(`🔃block's state_root = ${block.stateRoot}`);

  let rpcProof = await instance.eth.getProof(
    accountId,
    [storageId],
    blockNumber
  );

  // @ts-ignore
  rpcProof.blockStateRoot = block.stateRoot;
  return rpcProof;
};

export const generateTransactionProof = async (
  txId: string,
  instance: Web3
) => {
  const transactionRPC: TransactionInfo = await instance.eth.getTransaction(
    txId
  );

  console.log("⬅️found transaction matching ID: ", txId);
  const typedTransaction: TypedTransaction = TransactionFactory.fromTxData({
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
  console.log("🔃serialized transaction to RLP form"); // console.log if u will (seems too long to show in command line output) utils.toHex(typedTransaction.serialize())
  const block = await instance.eth.getBlock(
    transactionRPC.blockHash as HexString32Bytes
  );
  console.log("⬅️found block for receipt: ", block.hash, block.number);
  let siblings: TransactionInfo[] = await Promise.all(
    // @ts-ignore
    block.transactions.map(async (txId: string) => {
      let sibling: TransactionInfo = await instance.eth.getTransaction(txId);
      return sibling;
    })
  );
  console.log(`⬅️fetched all ${siblings.length} sibling transactions`);
  let proofOutput = await calculateTransactionProof(
    siblings,
    transactionRPC.transactionIndex as number
  );
  const proofOutputHex = {
    proof: proofOutput.proof.map((node: Buffer) => node.toString("hex")),
    root: proofOutput.root.toString("hex"),
    index: encode(transactionRPC.transactionIndex as number),
    value: proofOutput.value.toString("hex"),
  };

  console.log(
    "🧮proof-calculated transactions root vs block transactions root: ",
    "0x" + proofOutputHex.root,
    block.transactionsRoot
  );

  return proofOutputHex;
};

export const getBlock = async (blockId: string, instance: any) => {
  await sleep(2000); // need to wait for RPC to by synced
  const block = await instance.eth.getBlock(blockId).catch((err: any) => {
    console.log("errrrr");
    console.log(err);
  });
  return block;
};

export const calculateReceiptProof = async (
  receipts: TransactionReceipt[],
  index: number
): Promise<{ proof: Buffer[]; root: Buffer; value: Buffer }> => {
  let trie = new Trie();

  for (let i = 0; i < receipts.length; i++) {
    const entry = receipts[i];
    const keyAsRlpEncodedTxIndex = encode(entry.transactionIndex as number);
    const valueAsRlpEncodedReceipt = receiptToRlp(entry);
    await trie.put(
      Buffer.from(keyAsRlpEncodedTxIndex),
      Buffer.from(valueAsRlpEncodedReceipt)
    );
  }

  const proof = await Trie.createProof(trie, Buffer.from(encode(index)));
  console.log("Computed Root: ", trie.root.toString("hex"));
  const verifyResult = await Trie.verifyProof(
    trie.root,
    Buffer.from(encode(index)),
    proof
  );
  if (verifyResult === null) {
    throw new Error("Proof is invalid");
  }
  const value: Buffer = verifyResult;

  return {
    proof,
    root: trie.root,
    value,
  };
};

export const calculateTransactionProof = async (
  transactions: TransactionInfo[],
  index: number
): Promise<{ proof: Buffer[]; root: Buffer; value: Buffer }> => {
  let trie = new Trie();

  for (let i = 0; i < transactions.length; i++) {
    const entry = transactions[i];
    const keyAsRlpEncodedTxIndex = encode(entry.transactionIndex as number);
    const valueAsRlpEncodedTransaction = encodeTxAsValidRLP(entry);
    await trie.put(
      Buffer.from(keyAsRlpEncodedTxIndex),
      Buffer.from(valueAsRlpEncodedTransaction)
    );
  }

  const proof = await Trie.createProof(trie, Buffer.from(encode(index)));
  const verifyResult = await Trie.verifyProof(
    trie.root,
    Buffer.from(encode(index)),
    proof
  );
  if (verifyResult === null) {
    throw new Error("💣💣💣 Proof is invalid 💣💣💣");
  }
  const value: Buffer = verifyResult;

  return {
    proof,
    root: trie.root,
    value,
  };
};

export const sleep = async (time: any) => {
  return new Promise((resolve) => setTimeout(resolve, time));
};
