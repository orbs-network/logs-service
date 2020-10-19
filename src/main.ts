import * as Logger from './logger';
import { parseArgs } from './cli-args';
import fs, { readFileSync, existsSync } from 'fs';
import { State } from './model/state';
import { serve } from './index';

process.on('uncaughtException', function (err) {
  Logger.log('Uncaught exception on process, shutting down:');
  Logger.error(err.stack);
  process.exit(1);
});

process.on('SIGINT', function () {
  Logger.log('Received SIGINT, shutting down.');
  if (server) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    server.close(function (err: any) {
      if (err) {
        Logger.error(err.stack || err.toString());
      }
      process.exit();
    });
  }
  process.exit();
});

function readVersionFile() {
  try {
    return fs.readFileSync('./version').toString().trim();
  } catch (err) {
    Logger.log(`Cound not find version: ${err.message}`);
  }
  return '';
}

Logger.log('Service started.');
const config = parseArgs(process.argv);
Logger.log(`Input config: '${JSON.stringify(config)}'.`);

const state = new State(readVersionFile());

let initState;

if (existsSync(config.StatusJsonPath)) {
  initState = JSON.parse(readFileSync(config.StatusJsonPath, 'utf-8'));
}

if (initState !== undefined) {
  for (const n in initState.Payload.Services) {
    state.Services[n] = Object.assign({}, initState.Payload.Services[n]);
  }
}

// start server
const server = serve(config, state);
