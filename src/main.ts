import * as Logger from './logger';
import { runStatusUpdateLoop } from '.';
import { parseArgs } from './cli-args';

process.on('uncaughtException', function (err) {
  Logger.log('Uncaught exception on process, shutting down:');
  Logger.error(err.stack);
  process.exit(1);
});

process.on('SIGINT', function () {
  Logger.log('Received SIGINT, shutting down.');
  process.exit();
});

Logger.log('Service started.');
const config = parseArgs(process.argv);
Logger.log(`Input config: '${JSON.stringify(config)}'.`);

runStatusUpdateLoop(config).catch((err) => {
  Logger.log('Exception thrown from runStatusUpdateLoop, shutting down:');
  Logger.error(err.stack);
  process.exit(128);
});
