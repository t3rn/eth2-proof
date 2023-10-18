/// <reference types="node" />
import pino from 'pino';
export declare const logger: import("pino").Logger<{
    level: string;
    formatters: {
        level: (label: string) => {
            level: string;
        };
    };
    base: undefined;
    stream: NodeJS.WriteStream & {
        fd: 1;
    };
    transport: {
        target: string;
    } | undefined;
}>;
export type Logger = pino.Logger;
