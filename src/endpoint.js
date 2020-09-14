const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const { spawn, exec: _exec } = require('child_process');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const exec = promisify(_exec);
const moment = require('moment');
const { trim, sortBy } = require('lodash');

function serviceLogsPath(basePath, name) {
    return path.join(basePath, name, 'logs');
}

// @TODO
/*
    1. Check if we can watch the file system and be notified of events such as file name changed
    just as the tail -F does - that way we can get a much cleaner way of understanding when a rotation has occured and respond instantly.

    2. Persist rotated batches state to disk
        Upon waking up with pre-existing state:   
        2.1 Check if some or all the rotated files still exist , if so , keep them intact.

        Incase we got disconnected for a longer period and none of the pre-existing state batches exist anymore:
        Increase the latest batch number by 2 and carry on as usual (re-number the existing rotated batches)

    3. Dockerize and push to github

    4. getBatches is the SSOT, and not line 13

    5. Identify current has changed (not same inode via fs.watch)

*/

export function setupLogsServerApp(app, config, state) {
    const logsBasePath = config.LogsPath;

    const rotationCheckerSingle = async function (service) {
        state.Services[service] = state.Services[service] || {
            currentBatchNumber: 1,
            currentHighestDisplayBatchNumber: undefined,
            currentBatchesSnapshotStringfied: undefined,
        };

        console.log(`[${new Date()}] rotation check cycle running..`);
        const result = await getRotatedFilesInPath(path.join(logsBasePath, 'nn', 'logs'));
        const currentSnapshot = state.Services[service].currentBatchesSnapshotStringfied || JSON.stringify(result);

        // This might be a weak check, while there are stronger ways to verify this,
        // we will leave this as so for now.
        if (currentSnapshot !== JSON.stringify(result)) {
            // Yay Rotation!
            console.log('rotation happened!', service);
            state.Services[service].currentBatchNumber++;
            state.Services[service].currentHighestDisplayBatchNumber++;
            state.Services[service].currentBatchesSnapshotStringfied = JSON.stringify(result);
        } else {
            console.log('nothing changed', service);
        }
    }

    const getDirectories = async (source) => {
        return (await readdir(source, { withFileTypes: true }))
            .filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);
    };

    const rotationCheckerFn = async () => {
        const services = await getDirectories(logsBasePath);
        console.log('received services: ', services);
        for (let n in services) {
            let service = services[n];
            rotationCheckerSingle(service);
        }
    };

    (async () => {
        await rotationCheckerFn();
    })();
    const periodicalRotationCheckPid = setInterval(rotationCheckerFn, 5 * 1000);

    process.on('beforeExit', () => {
        console.log('Cleaning up before exit..');
        clearInterval(periodicalRotationCheckPid);
    });

    async function getLogFileUnixTimeStamp(fileName) {
        const result = await exec(`echo "${fileName.replace('.u', '').replace('.s', '')}" | tai64nlocal`);
        return trim(result.stdout);
    }

    async function getRotatedFilesInPath(targetPath) {
        const result = await readdir(targetPath);
        return result.filter(f => f.substr(0, 1) === '@');
    }

    async function getBatchesForPath(service) {
        const targetPath = serviceLogsPath(logsBasePath, service);

        console.log('got to getBatchesForPath with', targetPath);
        const availableNonCurrentFiles = await getRotatedFilesInPath(targetPath);

        const availableFiles = await Promise.all(availableNonCurrentFiles.map(async (file) => {
            const fileInHumanTime = await getLogFileUnixTimeStamp(file);
            const statResult = await stat(path.join(targetPath, file));

            return {
                fileName: file,
                batchSize: statResult.size,
                fileInHumanTime,
                unixTs: moment(fileInHumanTime).format('x')
            };
        }));

        const sortedFiles = sortBy(availableFiles, ['unixTs']);
        let last;

        for (let i = sortedFiles.length, j = state.Services[service].currentBatchNumber; i > 0; i--, j++) {
            sortedFiles[i - 1].id = j;
            last = j;
        }

        const statResultForCurrent = await stat(path.join(targetPath, 'current'));
        sortedFiles.unshift({
            fileName: 'current',
            batchSize: statResultForCurrent.size,
            id: last + 1
        });

        state.Services[service].currentHighestDisplayBatchNumber = last + 1;

        const availableNonCurrentFilesAgain = await getRotatedFilesInPath(targetPath);

        if (JSON.stringify(availableNonCurrentFilesAgain) !== JSON.stringify(availableNonCurrentFiles)) {
            return getBatchesForPath(service);
        }

        return sortedFiles;
    }

    app.get('/logs/:service/tail', (req, res) => {
        const preparedPath = serviceLogsPath(logsBasePath, req.params.service);

        const tailSpawn = spawn('tail', ['-F', path.join(preparedPath, 'current')]);

        tailSpawn.stdout.on('data', (data) => {
            res.write(data);
        });

        tailSpawn.on('close', (code) => {
            res.end();
        });
    });

    const fetchBatchFn = async (req, res) => {
        const { id, service } = req.params;
        const follow = 'follow' in req.query;
        let startBatchesInJSON;

        const servicePath = serviceLogsPath(logsBasePath, service);

        const batches = await getBatchesForPath(service);
        startBatchesInJSON = JSON.stringify(batches);
        const requestedBatch = batches.find(batch => parseInt(batch.id) === parseInt(id));

        if (!requestedBatch) {
            res.status(404).end();
            return;
        }

        if (requestedBatch.fileName === 'current') {
            if (follow) {
                let startBatchNumber = state.Services[service].currentBatchNumber;
                let requestRotationCheckPid;

                const tailSpawn = spawn('tail', ['-f', '-n', '+1', path.join(servicePath, 'current')]);
                let initRaceConditionCheck = false;

                tailSpawn.stdout.on('data', async (data) => {
                    const freshBatches = await getBatchesForPath(service);

                    if (!initRaceConditionCheck && startBatchesInJSON !== JSON.stringify(freshBatches)) {
                        // This race condition means that since the previous call to get batches from the file system
                        // rotation happened, so we should re-visit the batches.
                        initRaceConditionCheck = true;
                        tailSpawn.kill();
                        return fetchBatchFn(req, res);
                    }

                    initRaceConditionCheck = true;
                    res.write(data);
                });

                tailSpawn.on('close', (code) => {
                    clearInterval(requestRotationCheckPid);
                    res.end();
                });

                requestRotationCheckPid = setInterval(() => {
                    const { currentBatchNumber } = state.Services[req.params.service];
                    console.log('batch tail checking rotation..');
                    if (currentBatchNumber !== startBatchNumber) {
                        console.log('rotation occured! currentBatch / startBatch dont match! killing the tail', currentBatchNumber, startBatchNumber);
                        tailSpawn.kill();
                    }
                }, 5 * 1000);
            } else {
                fs.createReadStream(path.join(servicePath, requestedBatch.fileName)).pipe(res);
            }
        } else {
            fs.createReadStream(path.join(servicePath, requestedBatch.fileName)).pipe(res);
        }
    };

    app.get('/logs/:service/batch/:id', fetchBatchFn);

    app.get('/logs/:service', async (req, res) => {
        const batches = await getBatchesForPath(req.params.service);
        res.json(batches).end();
    });
}



module.exports = {
    setupLogsServerApp
};