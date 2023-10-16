/// <reference types="node" />
import { TransactionReceipt } from 'web3';
import { TransactionInfo } from 'web3-types';
export declare class ProofGenerator {
    private readonly web3;
    constructor(rpcUrl: string);
    static encode(input: any): Uint8Array;
    static receiptToRlp(receipt: TransactionReceipt): Uint8Array;
    generateTxReceiptProof(txId: string): Promise<{
        proof: string[];
        root: string;
        value: string;
    }>;
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
    static encodeTxAsValidRLP(tx: TransactionInfo): Buffer;
    generateStateProof(accountId: string, storageId: string, blockNumber: number | string): Promise<{
        readonly balance: bigint;
        readonly codeHash: string;
        readonly nonce: bigint;
        readonly storageHash: string;
        readonly accountProof: string[];
        readonly storageProof: {
            readonly key: string;
            readonly value: bigint;
            readonly proof: string[];
        }[];
    }>;
    generateTransactionProof(txId: string): Promise<{
        proof: string[];
        root: string;
        index: Uint8Array;
        value: string;
    }>;
    getBlock(blockId: string): Promise<void | {
        readonly parentHash: string;
        readonly sha3Uncles: string;
        readonly miner: string;
        readonly stateRoot: string;
        readonly transactionsRoot: string;
        readonly receiptsRoot: string;
        readonly logsBloom?: string | undefined;
        readonly difficulty?: bigint | undefined;
        readonly number: bigint;
        readonly gasLimit: bigint;
        readonly gasUsed: bigint;
        readonly timestamp: bigint;
        readonly extraData: string;
        readonly mixHash: string;
        readonly nonce: bigint;
        readonly totalDifficulty: bigint;
        readonly baseFeePerGas?: bigint | undefined;
        readonly size: bigint;
        readonly transactions: string[] | {
            readonly blockHash?: string | undefined;
            readonly blockNumber?: bigint | undefined;
            readonly from: string;
            readonly hash: string;
            readonly transactionIndex?: bigint | undefined;
            to?: string | null | undefined;
            value?: bigint | undefined;
            accessList?: {
                readonly address?: string | undefined;
                readonly storageKeys?: string[] | undefined;
            }[] | undefined;
            common?: {
                customChain: {
                    name?: string | undefined;
                    networkId: bigint;
                    chainId: bigint;
                };
                baseChain?: import("web3").ValidChains | undefined;
                hardfork?: "chainstart" | "frontier" | "homestead" | "dao" | "tangerineWhistle" | "spuriousDragon" | "byzantium" | "constantinople" | "petersburg" | "istanbul" | "muirGlacier" | "berlin" | "london" | "altair" | "arrowGlacier" | "grayGlacier" | "bellatrix" | "merge" | "capella" | "shanghai" | undefined;
            } | undefined;
            gas?: bigint | undefined;
            gasPrice?: bigint | undefined;
            type?: bigint | undefined;
            maxFeePerGas?: bigint | undefined;
            maxPriorityFeePerGas?: bigint | undefined;
            data?: string | undefined;
            input?: string | undefined;
            nonce?: bigint | undefined;
            chain?: import("web3").ValidChains | undefined;
            hardfork?: "chainstart" | "frontier" | "homestead" | "dao" | "tangerineWhistle" | "spuriousDragon" | "byzantium" | "constantinople" | "petersburg" | "istanbul" | "muirGlacier" | "berlin" | "london" | "altair" | "arrowGlacier" | "grayGlacier" | "bellatrix" | "merge" | "capella" | "shanghai" | undefined;
            chainId?: bigint | undefined;
            networkId?: bigint | undefined;
            gasLimit?: bigint | undefined;
            yParity?: string | undefined;
            v?: bigint | undefined;
            r?: string | undefined;
            s?: string | undefined;
        }[];
        readonly uncles: string[];
        readonly hash?: string | undefined;
    }>;
    static calculateReceiptProof(receipts: TransactionReceipt[], index: number): Promise<{
        proof: Buffer[];
        root: Buffer;
        value: Buffer;
    }>;
    static calculateTransactionProof(transactions: TransactionInfo[], index: number): Promise<{
        proof: Buffer[];
        root: Buffer;
        value: Buffer;
    }>;
}
