/**
 * Sleep for a given number of seconds.
 * @param {number}  seconds seconds to sleep for
 * @param {string=} reason reason for sleeping
 */
export declare function sleep(seconds: number, reason?: string): Promise<void>;
export declare function asciiToBytes(str: string): Uint8Array;
