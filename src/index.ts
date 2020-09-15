import express, { Request, Response } from 'express';
import { Configuration } from './config';
import cors from 'cors';
import * as Logger from './logger';
import { sleep, errorString } from './helpers';
import { generateStatusObj, writeStatusToDisk } from './status';
import { State } from './model/state';
import { setupLogsServerApp } from './endpoint';

export function serve(serviceConfig: Configuration) {
  const state = new State();

  const app = express();
  // DEV_NOTE : O.L : Allows access from any domain.
  app.use(cors());
  app.set('json spaces', 2);

  app.get('/', (_: Request, response: Response) => {
    response.status(200).json({});
  });

  app.get('/status', (_request: Request, response: Response) => {
    const body = generateStatusObj(state, serviceConfig, undefined);
    response.status(200).json(body);
  });

  setupLogsServerApp(app, serviceConfig, state);

  app.use((error: Error, req: Request, res: Response) => {
    console.log('inside error handler of express', error, typeof error);
    if (error instanceof Error) {
      Logger.error(`Error response to ${req.url}: ${errorString(error)}.`);
      return res.status(500).json({
        status: 'error',
        error: errorString(error),
      });
    }

    return res.status(500).render('500');
  });

  return app.listen(serviceConfig.Port, '0.0.0.0', () =>
    Logger.log(`Logs service listening on port ${serviceConfig.Port}!`)
  );
}

export async function runStatusUpdateLoop(config: Configuration) {
  const state = new State();
  writeStatusToDisk(config.StatusJsonPath, state, config);
  for (; ;) {
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
