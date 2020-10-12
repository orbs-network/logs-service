const { spawn } = require('child_process');
const { sortBy, now } = require('lodash');

function tail (state, request, params) {
    const tailObj = {
        start: new Date(),
        request: request,
    };

    tailObj.childProcess = spawn('tail', params).on('exit', (code, signal) => {
        console.log(`tail process ${tailObj.childProcess.pid} exited with code ${code} and signal ${signal}`);
        tailObj.end = new Date();
    });

    state.ActiveTails.push(tailObj);

    console.log(`tail process ${tailObj.childProcess.pid} started`);
    return tailObj.childProcess;
}

function tailProcessExited(activeTail) {
    return (
        activeTail.end ||
        activeTail.childProcess.exitCode !== null ||
        activeTail.childProcess.signalCode !== null
    );
}

function pruneTerminatedTails(state) {
    const prunedTerminated = [];
    const minEndTime = now() - 1000 * 60 * 60 * 24 * 7; // one week ago
    for (const tail of state.TerminatedTails) {
        if (tail.end.getTime() > minEndTime) {
            prunedTerminated.push(tail);
        }
    }
    state.TerminatedTails = sortBy(prunedTerminated, ['end']).slice(-100); // clip last 100
}

function pruneActiveTails(state) {
    const prunedActive = [];
    for (const activeTail of state.ActiveTails) {
        if (tailProcessExited(activeTail)) {
            state.TerminatedTails.push(activeTail);
            activeTail.terminated = activeTail.end || new Date(); // in case event did not fire
        } else {
            prunedActive.push(activeTail);
        }
    }
    state.ActiveTails = prunedActive;
}

function pruneTailLists(state) {
    pruneActiveTails(state);
    pruneTerminatedTails(state);
}

module.exports = {
    tail,
    pruneTailLists
};
