"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asciiToBytes = exports.sleep = void 0;
/**
 * Sleep for a given number of seconds.
 * @param {number}  seconds seconds to sleep for
 * @param {string=} reason reason for sleeping
 */
function sleep(seconds, reason) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, seconds * 1000);
    });
}
exports.sleep = sleep;
function asciiToBytes(str) {
    const bytesArray = [];
    for (let i = 0; i < str.length; i++) {
        bytesArray.push(str.charCodeAt(i));
    }
    return new Uint8Array(bytesArray);
}
exports.asciiToBytes = asciiToBytes;
//# sourceMappingURL=helpers.js.map