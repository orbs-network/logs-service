import { Configuration } from './config';

export const exampleConfig: Configuration = {
  Port: 8080,
  SkipBatchesOnMismatch: 3,
  LogsPath: './logs-root',
  StatusJsonPath: './status/status.json',
  StatusUpdateLoopIntervalSeconds: 20,
};
