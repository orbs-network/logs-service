import * as Logger from './logger';
import { State } from './model/state';
import { writeFileSync } from 'fs';
import { ensureFileDirectoryExists, JsonResponse, getCurrentClockTime } from './helpers';
import { Configuration } from './config';
import { lsof } from 'list-open-files';

export async function generateStatusObj(state: State, config: Configuration, err?: Error) {
  const lastLsof = await lsof();
  const status: JsonResponse = {
    Status: getStatusText(state),
    Timestamp: new Date().toISOString(),
    Payload: {
      Uptime: getCurrentClockTime() - state.ServiceLaunchTime,
      MemoryBytesUsed: process.memoryUsage().heapUsed,
      OpenFiles: lastLsof[0].files.length,
      Config: config,
      Services: state.Services,
      Tails: state.ActiveTails,
    },
  };

  // include error field if found errors
  const errorText = getErrorText(state, err);
  if (errorText) {
    status.Error = errorText;
  }
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

function getStatusText(state: State) {
  const res = [];
  if (state.ServiceLaunchTime === getCurrentClockTime()) {
    res.push('starting');
  }

  if (state.ServiceLaunchTime < getCurrentClockTime()) {
    res.push('started');
  }
  return res.join(', ');
}

function getErrorText(state: State, err?: Error) {
  const res = [];

  if (state.ServiceLaunchTime === 0) {
    // TODO replace with a meaning full inspection of the state
    res.push('Invalid launch time');
  }

  if (err) {
    res.push(`Error: ${err.message}.`);
  }
  return res.join(' ');
}
