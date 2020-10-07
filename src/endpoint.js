const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const { spawn, exec: _exec } = require('child_process');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const exec = promisify(_exec);
const moment = require('moment');
const { trim, sortBy } = require('lodash');
const { writeStatusToDisk } = require('./status');

function serviceLogsPath(basePath, name) {
    if (name === 'logs-service') { // TODO - remove when boyar mounts all alike
        return basePath;
    }
    return path.join(basePath, name);
}

// @TODO
/*
    1. Check if we can watch the file system and be notified of events such as file name changed
    just as the tail -F does - that way we can get a much cleaner way of understanding when a rotation has occured and respond instantly.
    2. Identify current has changed (not same inode via fs.watch)
*/

function removeTailFromActives(state, pid) {
    const tailIndex = state.ActiveTails.findIndex(t => t.processId === pid);
    if (tailIndex !== -1) {
        state.ActiveTails.splice(tailIndex, 1);
    }
}

export function setupLogsServerApp(app, config, state, Logger) {
    const logsBasePath = config.LogsPath;

    const rotationCheckerSingle = async function (service) {
        const targetPath = serviceLogsPath(logsBasePath, service);

        state.Services[service] = state.Services[service] || {
            mapping: {},
        };

        try {
            const availableNonCurrentFiles = await getRotatedFilesInPath(targetPath);
            const availableFiles = availableNonCurrentFiles.map(f => {
                const cleanFilename = f.replace('@', '').replace('.u', '').replace('.s', '');
                return { fileName: f, cleanFilename };
            });

            const lastKnownMaxBatch = Math.max(...Object.values(state.Services[service].mapping));
            const firstBatchIdIfNoneMatch = lastKnownMaxBatch > 0 ? lastKnownMaxBatch + config.SkipBatchesOnMismatch : 1;
            const { mapping } = resolveBatchMapping(state.Services[service].mapping, service, availableFiles, config, firstBatchIdIfNoneMatch);

            state.Services[service].mapping = mapping;
        } catch (err) {
            return Promise.resolve(`Couldnt check rotation status for: ${targetPath} with error: ${err.toString()}`);
        }
    }

    const getDirectories = async (source) => {
        return (await readdir(source, { withFileTypes: true }))
            .filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);
    };

    const rotationCheckerFn = async () => {
        const services = await getDirectories(logsBasePath);

        for (let n in services) {
            let service = services[n];
            await rotationCheckerSingle(service);
        }

        try {
            // write status.json file, we don't mind doing this often
            await writeStatusToDisk(config.StatusJsonPath, state, config);
        } catch (err) {
            Logger.log('Exception thrown during runStatusUpdateLoop!');
            Logger.error(err.stack);

            // always write status.json file (and pass the error)
            await writeStatusToDisk(config.StatusJsonPath, state, config, err);
        }
    };

    (async () => {
        await rotationCheckerFn();
    })();
    // TODO - make sure we have no overlap calls to rotationCheckerFn
    const periodicalRotationCheckPid = setInterval(rotationCheckerFn, config.StatusUpdateLoopIntervalSeconds * 1000);

    process.on('beforeExit', () => {
        clearInterval(periodicalRotationCheckPid);
    });

    async function getRotatedFilesInPath(targetPath) {
        const result = await readdir(targetPath);
        return result.filter(f => f.substr(0, 1) === '@');
    }

    async function getBatchesForPath(service) {
        const targetPath = serviceLogsPath(logsBasePath, service);
        const availableNonCurrentFiles = await getRotatedFilesInPath(targetPath);

        const availableFiles = await Promise.all(availableNonCurrentFiles.map(async (f) => {
            const statResult = await stat(path.join(targetPath, f));
            const cleanFilename = f.replace('@', '').replace('.u', '').replace('.s', '');
            return { fileName: f, cleanFilename, batchSize: statResult.size, };
        }));

        const { sortedFiles } = resolveBatchMapping(state.Services[service].mapping, service, availableFiles, config, () => { throw new Error('stale mapping, cannot resolve batch ids'); });

        const statResultForCurrent = await stat(path.join(targetPath, 'current'));
        sortedFiles.push({
            fileName: 'current',
            batchSize: statResultForCurrent.size,
            id: (sortedFiles.length === 0) ? 1 : sortedFiles[sortedFiles.length - 1].id + 1
        });

        // detect changes since first getRotatedFilesInPath TODO remove when no IO is perfoermed since getRotatedFilesInPath)
        const availableNonCurrentFilesAgain = await getRotatedFilesInPath(targetPath);
        if (JSON.stringify(availableNonCurrentFilesAgain) !== JSON.stringify(availableNonCurrentFiles)) {
            return getBatchesForPath(service);
        }

        return sortedFiles.reverse();
    }

    const constantTailPath = '/logs/:service/tail';
    app.get(constantTailPath, async (req, res, next) => {
        const preparedPath = serviceLogsPath(logsBasePath, req.params.service);
        const currentPath = path.join(preparedPath, 'current');

        if (!(await promisify(fs.exists)(currentPath))) {
            res.status(404).send('Could not find the requested service or log file').end();
            return;
        }
        const tailSpawn = spawn('tail', ['-F', currentPath]);
        state.ActiveTails.push({
            processId: tailSpawn.pid,
            ip: req.ip,
            path: req.originalUrl,
        });

        tailSpawn.stdout.on('data', (data) => {
            res.write(data);
        });

        tailSpawn.stderr.on('data', (data) => {
            next(new Error(data));
        });

        req.on('close', () => {
            // request closed unexpectedly
            removeTailFromActives(state, tailSpawn.pid);
            tailSpawn.kill();
        });

        req.on('end', () => {
            removeTailFromActives(state, tailSpawn.pid);
            // request ended normally
            tailSpawn.kill();
        });

        tailSpawn.on('close', (code) => {
            res.end();
        });
    });

    const fetchBatchFn = async (req, res) => {
        const { id, service } = req.params;
        const { start } = req.query;
        const follow = 'follow' in req.query;
        let startBatchesInJSON;

        const servicePath = serviceLogsPath(logsBasePath, service);

        const batches = await getBatchesForPath(service);

        const flatr = b => {
            return {
                f: b.fileName,
                id: b.id,
            };
        };

        startBatchesInJSON = JSON.stringify(batches.map(flatr));
        const requestedBatch = batches.find(batch => parseInt(batch.id) === parseInt(id));

        if (!requestedBatch) {
            res.status(404).end();
            return;
        }

        let streamOptions = {};
        let tailArgs = ['-n', '+1'];

        if (start > 0) {
            // if (parseInt(start) >= requestedBatch.batchSize) {
            //     return Promise.reject(new Error(`Cannot request data from an offset bigger than the batch size itself! Batch requested: ${requestedBatch.id}, size (bytes): ${requestedBatch.batchSize}, requested from block: ${start}`));
            // }
            streamOptions = { start: parseInt(start) };
            tailArgs = ['-c', `+${start}`];
        }

        if (requestedBatch.fileName === 'current') {
            if (follow) {
                let startMappingVer = Math.max(...Object.values(state.Services[service].mapping)) + 1;
                let requestRotationCheckPid;

                const tailSpawn = spawn('tail', ['-f', ...tailArgs, path.join(servicePath, 'current')]);
                let initRaceConditionCheck = false;

                state.ActiveTails.push({
                    processId: tailSpawn.pid,
                    ip: req.ip,
                    path: req.originalUrl,
                });

                tailSpawn.stdout.on('data', async (data) => {
                    const freshBatches = await getBatchesForPath(service);

                    if (!initRaceConditionCheck && startBatchesInJSON !== JSON.stringify(freshBatches.map(flatr))) {
                        // This race condition means that since the previous call to get batches from the file system
                        // rotation happened, so we should re-visit the batches.
                        initRaceConditionCheck = true;
                        removeTailFromActives(state, tailSpawn.pid);
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

                req.on('close', () => {
                    // request closed unexpectedly
                    removeTailFromActives(state, tailSpawn.pid);
                    tailSpawn.kill();
                });

                req.on('end', () => {
                    removeTailFromActives(state, tailSpawn.pid);
                    // request ended normally
                    tailSpawn.kill();
                });

                requestRotationCheckPid = setInterval(() => {
                    const currentMappingVer = Math.max(...Object.values(state.Services[service].mapping)) + 1;
                    console.log('checking whether we should kill the tail (current)', currentMappingVer);
                    if (currentMappingVer !== startMappingVer) {
                        removeTailFromActives(state, tailSpawn.pid);
                        console.log('checking whether we should kill the tail (current,start)', currentMappingVer, startMappingVer);
                        tailSpawn.kill();
                    }
                }, 5 * 1000);
            } else {
                fs.createReadStream(path.join(servicePath, requestedBatch.fileName), streamOptions).pipe(res);
            }
        } else {
            fs.createReadStream(path.join(servicePath, requestedBatch.fileName), streamOptions).pipe(res);
        }
    };

    app.get('/logs/:service/batch/:id', async (req, res, next) => {
        try {
            await fetchBatchFn(req, res);
        } catch (err) {
            next(err);
        }
    });

    app.get('/logs/:service', async (req, res, next) => {
        try {
            const batches = await getBatchesForPath(req.params.service);
            res.json(batches).end();
        } catch (err) {
            next(err);
        }
    });
}

module.exports = {
    setupLogsServerApp
};

function resolveBatchMapping(lastKnownMapping, service, fileDescriptors, config, firstBatchIdIfNoneMatch) {
    const mapping = {};
    let prevBatchNum;

    const sortedFiles = sortBy(fileDescriptors, ['cleanFilename']).map((item, i) => {
        let batchNum = lastKnownMapping[item.fileName];
        if (batchNum === undefined) {
            if (prevBatchNum) {
                batchNum = prevBatchNum + 1;
            } else if (typeof firstBatchIdIfNoneMatch === 'function') {
                batchNum = firstBatchIdIfNoneMatch();
            } else {
                batchNum = firstBatchIdIfNoneMatch;
            }
        }
        item.id = batchNum;
        mapping[item.fileName] = batchNum;
        prevBatchNum = batchNum;
        return item;
    });

    return { mapping, sortedFiles };
}

