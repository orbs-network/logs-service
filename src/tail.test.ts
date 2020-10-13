import fs from 'fs';
import test from 'ava';
import { State } from './model/state';

import { tail } from "./tail";

const tmpFileName = './tail-test';

test.serial.afterEach.always(() => {
    fs.unlinkSync(tmpFileName);
});

test.serial('tails a simple file', async (t) => {
    const state = new State();

    fs.writeFileSync(tmpFileName, 'blablabla');

    const readText = await new Promise((resolve, reject) => {
        let result = '';
        tail(state, undefined, [tmpFileName])
            .on('close', (exitCode: number, signalCode: number) => {
                if (exitCode === 0) { // success
                    resolve(result)
                    return;
                }
                reject(`abnormal termination (error level ${exitCode}, signal ${signalCode})`)
            })
            .stdout.on('data', (text: any) => {
                result += text.toString();
            })
    });

    t.deepEqual(readText, 'blablabla');
});

// TODO add a test that additional parameters are passed to tail - e.g. -f - no need to cover all variations

// TODO add unit tests for prune functions and tail registration state
