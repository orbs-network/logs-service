import * as Logger from './logger';
import { parseArgs } from './cli-args';
import { serve } from './index';
import {loadState} from "./helpers";

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

Logger.log('Service started.');
const config = parseArgs(process.argv);
Logger.log(`Input config: '${JSON.stringify(config)}'.`);

const state = loadState(config);

// start server
const server = serve(config, state);
