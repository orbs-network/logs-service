import fs from 'fs';
import test from 'ava';
import { State } from './model/state';

import { tail, pruneActiveTails, pruneTerminatedTails } from "./tail";
import { sleep } from "./helpers";
import {ChildProcess} from "child_process";

const tmpFileName1 = './tail-test1';
const tmpFileName2 = './tail-test2';

test.serial.afterEach.always(() => {
    // eslint-disable-next-line no-empty
    try{ fs.unlinkSync(tmpFileName1) } catch (e) {}
    // eslint-disable-next-line no-empty
    try{ fs.unlinkSync(tmpFileName2) } catch (e) {}
});

test.serial('tails a simple file', async (t) => {
    const state = new State();

    const text = "some Text";
    fs.writeFileSync(tmpFileName1, text);

    let result = '';
    let exitCode = null;
    const cp = tail(state, undefined, [tmpFileName1])
        .on('close', (ec: number) => {exitCode = ec});
    cp.stdout.on('data', (text: string) => { result += text.toString()});

    await waitUntilStreamsClose(cp);

    t.deepEqual(result, text);
    t.deepEqual(exitCode, 0);
});

test.serial('tail skips n bytes', async (t) => {
    const state = new State();

    const skipBytes = 5;
    const text = "some Text";
    fs.writeFileSync(tmpFileName1, text);

    let result = '';
    let exitCode = null;
    const cp = tail(state, undefined, ['-c', `+${skipBytes+1}`, tmpFileName1])
        .on('close', (ec: number) => {exitCode = ec});
    cp.stdout.on('data', (text: string) => { result += text.toString()});

    await waitUntilStreamsClose(cp);

    t.deepEqual(result, text.slice(skipBytes));
    t.deepEqual(exitCode, 0);
});

test.serial('tails with -F', async (t) => {
    const state = new State();

    const fileText1 = 'text1';
    const fileText2 = 'text2';
    fs.writeFileSync(tmpFileName1, fileText1);

    let stillRunning = true;
    const cp = tail(state, undefined, ['-F', tmpFileName1])
        .on('exit', () => {stillRunning = false});

    let readText = '';
    cp.stdout.on('data', (text: string) => { readText += text.toString()});

    // wait until we read the contents of the file
    while (readText != fileText1) {
        await sleep(5);
    }
    // rotate files:
    fs.renameSync(tmpFileName1, tmpFileName2);
    fs.writeFileSync(tmpFileName1, fileText2);

    t.log('waiting for tail to pick up on rotated file...');
    while (readText != fileText1 + fileText2) {
        await sleep(5);
    }

    await sleep(1000);
    t.truthy(stillRunning, 'tail process did not stay running');

    cp.kill();
    const [exitCode, signalCode] = await waitUntilStreamsClose(cp);

    t.log('exit', exitCode, 'signal', signalCode);
    t.truthy(exitCode === null && signalCode === 'SIGTERM', 'tail process did not die with SIGTERM');
});

test.serial('prunes tail tasks on state object', async (t) => {
    const state = new State();

    const fileText = 'text1';
    fs.writeFileSync(tmpFileName1, fileText);

    const cp1 = tail(state, undefined, ['-f', tmpFileName1]);
    const cp2 = tail(state, undefined, ['-f', tmpFileName1]);
    const cp3 = tail(state, undefined, ['-f', tmpFileName1]);

    await sleep(100);
    t.deepEqual(state.TerminatedTails, []);
    t.deepEqual(state.ActiveTails.map(t=>t.childProcess), [cp1,cp2,cp3]);

    cp2.kill();

    t.log('wait for c2 to die');
    await waitUntilStreamsClose(cp2);

    t.deepEqual(state.TerminatedTails, []);
    t.deepEqual(state.ActiveTails.map(t=>t.childProcess), [cp1,cp2,cp3]);

    pruneActiveTails(state);

    t.deepEqual(state.TerminatedTails.map(t=>t.childProcess), [cp2]);
    t.deepEqual(state.ActiveTails.map(t=>t.childProcess), [cp1,cp3]);

    // take some space between both "end" timestamps
    await sleep(10);

    cp3.kill();
    t.log('wait for c3 to die');
    await waitUntilStreamsClose(cp3);
    pruneActiveTails(state);
    pruneTerminatedTails(state, 10);

    t.deepEqual(state.TerminatedTails.map(t=>t.childProcess), [cp3]);
    t.deepEqual(state.ActiveTails.map(t=>t.childProcess), [cp1]);
});

async function waitUntilStreamsClose(childProcess: ChildProcess) : Promise<[number, string]> {
    return new Promise((res) => childProcess.on('close', (e,s)=>{res([e,s])}));
}
