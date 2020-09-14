import * as Logger from './logger';
import { sleep } from './helpers';
import { Configuration } from './config';
import { writeStatusToDisk } from './status';
import { State } from './model/state';

export async function runStatusUpdateLoop(config: Configuration) {
  const state = new State();
  writeStatusToDisk(config.StatusJsonPath, state, config);
  for (;;) {
    try {
      // rest (to make sure we don't retry too aggressively on exceptions)
      await sleep(config.StatusUpdateLoopIntervalSeconds * 1000);

      // write status.json file, we don't mind doing this often (20s)
      writeStatusToDisk(config.StatusJsonPath, state, config);
    } catch (err) {
      Logger.log('Exception thrown during runStatusUpdateLoop, going back to sleep:');
      Logger.error(err.stack);

      // always write status.json file (and pass the error)
      writeStatusToDisk(config.StatusJsonPath, state, config, err);
    }
  }
}
