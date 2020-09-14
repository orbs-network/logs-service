import * as Logger from './logger';
import {runStatusUpdateLoop, serve} from '.';
import { parseArgs } from './cli-args';

process.on('uncaughtException', function (err) {
  Logger.log('Uncaught exception on process, shutting down:');
  Logger.error(err.stack);
  process.exit(1);
});

Logger.log('Service started.');
const config = parseArgs(process.argv);
Logger.log(`Input config: '${JSON.stringify(config)}'.`);

// start status update loop.
runStatusUpdateLoop(config).catch((err) => {
  Logger.log('Exception thrown from runStatusUpdateLoop, shutting down:');
  Logger.error(err.stack);
  process.exit(128);
});

// start server
const server = serve(config);

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
