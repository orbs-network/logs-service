import test from 'ava';
import { State } from './model/state';

import {tail} from "./tail";

test.serial.afterEach.always(() => {
    // TODO cleanup any temp files
});

test.serial('tails a simple file', async (t) => {
    const state = new State();

    const tmpFileName = './some.file';
    // TODO write a temp file

    const readText = await new Promise((resolve, reject) => {
        tail(state, undefined, [tmpFileName])
            .on('data', (text: string) => resolve(text))
            .on('close', (exitCode: number, signalCode: number) => {
                if (exitCode ===  0){ // success
                    // TODO read stdout and resolve
                    return;
                }
                reject(`abnormal termination (error level ${exitCode}, signal ${signalCode})`)
            });
    });

    t.deepEqual(readText, 'some lines');
});

// TODO add a test that additional parameters are passed to tail - e.g. -f - no need to cover all variations

// TODO add unit tests for prune functions and tail registration state
