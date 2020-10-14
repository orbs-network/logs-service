import * as Logger from './logger';
import { pruneTailLists } from './tail';
import { State, Tailer } from './model/state';
import { writeFileSync } from 'fs';
import { exec } from 'child-process-promise';
import { ensureFileDirectoryExists, JsonResponse, getCurrentClockTime } from './helpers';
import { Configuration } from './config';
import * as fs from 'fs';

async function getOpenFilesCount() {
  const result = await exec('lsof -l | wc -l');
  return parseInt(result.stdout);
}

function renderTailProcessDesc(t: Tailer) {
  return {
    processId: t.childProcess.pid,
    status: `exit code: ${(t.childProcess as any).exitCode} signal: ${(t.childProcess as any).signalCode}`,
    start: t.start ? t.start.toISOString() : 'NA',
    end: t.end ? t.end.toISOString() : 'NA',
    url: t.url,
    headers: t.requestHeaders,
    bytesRead: t.bytesRead
  };
}

export async function generateStatusObj(state: State, config: Configuration, err?: Error) {
  const OpenFiles = await getOpenFilesCount();
  pruneTailLists(state);

  // include error field if found errors
  const errorText = getErrorText(state, config, err);
  const status: JsonResponse = {
    Status: errorText ? 'Error' : 'OK',
    Error: errorText,
    Timestamp: new Date().toISOString(),
    Payload: {
      Uptime: getCurrentClockTime() - state.ServiceLaunchTime,
      MemoryBytesUsed: process.memoryUsage().heapUsed,
      OpenFiles,
      Config: config,
      Services: state.Services,
      TailsActive: state.ActiveTails.map(renderTailProcessDesc),
      TailsTerm: state.TerminatedTails.map(renderTailProcessDesc),
    },
  };

  return status;
}

export async function writeStatusToDisk(filePath: string, state: State, config: Configuration, err?: Error) {
  const status = await generateStatusObj(state, config, err);

  // do the actual writing to local file
  ensureFileDirectoryExists(filePath);
  const content = JSON.stringify(status, null, 2);
  writeFileSync(filePath, content);

  // log progress
  Logger.log(`Wrote status JSON to ${filePath} (${content.length} bytes).`);
}

// helpers

function getErrorText(state: State, config: Configuration, err?: Error) {
  const res = [];

  if (state.ServiceLaunchTime === 0) {
    // TODO replace with a meaning full inspection of the state
    res.push('Invalid launch time');
  }

  if (!fs.existsSync(config.LogsPath)) {
    res.push('Disk access error');
  }

  if (err) {
    res.push(`Error: ${err.message}.`);
  }
  return (res.length) ? res.join(',') : undefined;
}
