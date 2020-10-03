import * as Logger from './logger';
import { State } from './model/state';
import { writeFileSync } from 'fs';
import { exec } from 'child-process-promise';
import { ensureFileDirectoryExists, JsonResponse, getCurrentClockTime } from './helpers';
import { Configuration } from './config';
import * as fs from "fs";

async function getOpenFilesCount() {
  const result = await exec('lsof -l | wc -l');
  return parseInt(result.stdout);
}

export async function generateStatusObj(state: State, config: Configuration, err?: Error) {
  const OpenFiles = await getOpenFilesCount();

  const status: JsonResponse = {
    Status: getStatusText(state),
    Timestamp: new Date().toISOString(),
    Payload: {
      Uptime: getCurrentClockTime() - state.ServiceLaunchTime,
      MemoryBytesUsed: process.memoryUsage().heapUsed,
      OpenFiles,
      Config: config,
      Services: state.Services,
      Tails: state.ActiveTails,
    },
  };

  // include error field if found errors
  const errorText = getErrorText(state, config, err);
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

function getErrorText(state: State, config: Configuration, err?: Error) {
  const res = [];

  if (state.ServiceLaunchTime === 0) {
    // TODO replace with a meaning full inspection of the state
    res.push('Invalid launch time');
  }

  if(!fs.existsSync(config.LogsPath)) {
    res.push('Disk access error');
  }

  if (err) {
    res.push(`Error: ${err.message}.`);
  }
  return res.join(' ');
}
