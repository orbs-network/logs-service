import _ from 'lodash';
import {existsSync, mkdirSync, readFileSync} from 'fs';
import { dirname } from 'path';
import {Configuration} from "./config";
import * as Logger from "./logger";
import {State} from "./model/state";

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ensureFileDirectoryExists(filePath: string) {
  mkdirSync(dirname(filePath), { recursive: true });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function errorString(e: any) {
  return (e && e.stack) || '' + e;
}

// returns UTC clock time in seconds (similar to unix timestamp / Ethereum block time / RefTime)
export function getCurrentClockTime() {
  return Math.round(new Date().getTime() / 1000);
}

export function getToday(): string {
  return new Date().toISOString().substr(0, 10);
}

export function toNumber(val: number | string) {
  if (typeof val == 'string') {
    return parseInt(val);
  } else return val;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonResponse = any;

export function jsonStringifyComplexTypes(obj: unknown): string {
  return JSON.stringify(
    obj,
    (key, value) => {
      if (key == 'privateKey') return '<redacted>';
      if (typeof value === 'bigint') return `BigInt(${value.toString()})`;
      if (typeof value == 'object') {
        if (value.constructor === Uint8Array) return `Uint8Array(${Buffer.from(value).toString('hex')})`;
      }
      return value; // return everything else unchanged
    },
    2
  );
}

export function loadState(config: Configuration) : State {
    const result = new State();
    let initState;

    if (existsSync(config.StatusJsonPath)) {
        let rawStatusFile;
        try {
            rawStatusFile = readFileSync(config.StatusJsonPath, 'utf-8');
            initState = JSON.parse(rawStatusFile);
        } catch (err) {
            Logger.log(`Error reading state from disk: ${err}`);
            return result;
        }
    }

    if (initState !== undefined) {
        for (const n in initState.Payload.Services) {
            result.Services[n] = Object.assign({}, initState.Payload.Services[n]);
        }
    }
    return result;
}
