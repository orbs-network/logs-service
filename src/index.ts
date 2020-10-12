import express, { Request, Response } from 'express';
import { Configuration } from './config';
import cors from 'cors';
import * as Logger from './logger';
import { State } from './model/state';
import { errorString } from './helpers';
import { generateStatusObj } from './status';
import { setupLogsServerApp } from './endpoint';

export function serve(serviceConfig: Configuration, state: State) {
  const app = express();

  // DEV_NOTE : O.L : Allows access from any domain.
  app.use(cors());
  app.set('trust proxy', true);
  app.set('json spaces', 2);

  app.get('/', (_: Request, response: Response) => {
    response.status(200).json({});
  });

  app.get('/status', async (_request: Request, response: Response) => {
    const body = await generateStatusObj(state, serviceConfig, undefined);
    response.status(200).json(body);
  });

  setupLogsServerApp(app, serviceConfig, state, Logger);

  app.use((error: Error, req: Request, res: Response, next: Function) => {
    console.log('inside error handler of express', error.message, typeof error, next);
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
