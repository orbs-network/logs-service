export interface Configuration {
  Port: number;
  StatusJsonPath: string;
  StatusUpdateLoopIntervalSeconds: number;
}

export const defaultConfiguration = {
  Port: 8080,
  StatusJsonPath: './status/status.json',
  StatusUpdateLoopIntervalSeconds: 20,
};

export function validateConfiguration(config: Configuration) {
  if (config.Port < 0) {
    throw new Error(`Port is not a positive number.`);
  }
  if (
    !config.StatusUpdateLoopIntervalSeconds ||
    isNaN(config.StatusUpdateLoopIntervalSeconds) ||
    config.StatusUpdateLoopIntervalSeconds <= 0
  ) {
    throw new Error(`StatusUpdateLoopIntervalSeconds is empty or non positive.`);
  }
  if (typeof config.StatusUpdateLoopIntervalSeconds != 'number') {
    throw new Error(`StatusUpdateLoopIntervalSeconds is not a number.`);
  }
  if (!config.StatusJsonPath || config.StatusJsonPath === '') {
    throw new Error(`StatusJsonPath is empty in config.`);
  }
}
