import test from 'ava';
import { dockerComposeTool, getAddressForService } from 'docker-compose-mocha';
import {mkdirSync, rmdirSync, unlinkSync, writeFileSync} from 'fs';
import { exec } from 'child_process';
import { exec as execPromise } from 'child-process-promise';
import { retry } from 'ts-retry-promise';
import { join } from 'path';
import fetch from 'node-fetch';

const e2eConfiguration = {
    Port: 8080,
    SkipBatchesOnMismatch: 3,
    LogsPath: '/opt/orbs/logs',
    StatusJsonPath: './status/status.json',
    StatusUpdateLoopIntervalSeconds: 5,
};

export class TestEnvironment {
  private envName: string = '';
  public testLogger: (lines: string) => void = (_: string) => {}; // silent by default
  private pathToDockerCompose: string;
  private pathToAppConfig: string;
  private pathToLogs: string;

  constructor(pathToDockerFolder: string) {
      this.pathToDockerCompose = join(pathToDockerFolder, 'docker-compose.yml');
      this.pathToAppConfig = join(pathToDockerFolder, '_app-config.json');
      this.pathToLogs = join(pathToDockerFolder, '_e2e-logs');
  }

  getAppConfig() {
    return e2eConfiguration;
  }

  // runs all the docker instances with docker-compose
  launchServices() {
    test.serial.before((t) => t.log('[E2E] driver launchServices() start'));

    // step 1 - write config file for app
    test.serial.before((t) => {
      t.log('[E2E] write config file for app and clear logs folder - before dockers go up');
      try {
        unlinkSync(this.pathToAppConfig);
        rmdirSync(this.pathToLogs, { recursive: true });
      } catch (err) {}
      const config = this.getAppConfig();
      writeFileSync(this.pathToAppConfig, JSON.stringify(config, null, 2));
      mkdirSync(this.pathToLogs, {recursive: true});
    });

    // step 2 - launch service docker
    test.serial.before((t) => t.log('[E2E] launch app docker'));
    this.envName = dockerComposeTool(
      test.serial.before.bind(test.serial),
      test.serial.after.always.bind(test.serial.after),
      this.pathToDockerCompose,
      {
        startOnlyTheseServices: ['writer', 'app'],
        shouldPullImages: false,
        cleanUp: false,
      } as any
    );

    // step 3 - start live dump of logs from app to test logger
    test.serial.before(async (t) => {
      t.log('[E2E] start live dump of logs from app to test logger');
      const logP = exec(`docker-compose -p ${this.envName} -f "${this.pathToDockerCompose}" logs -f app`);
      this.testLogger = t.log;
      // @ts-ignore
      logP.stdout.on('data', (data) => {
        if (this.testLogger) this.testLogger(data);
      });
      logP.on('exit', () => {
        if (this.testLogger) this.testLogger(`app log exited`);
      });
    });

      // step 4 - start live dump of logs from writer to test logger
      test.serial.before(async (t) => {
          t.log('[E2E] start live dump of logs from writer to test logger');
          const logP = exec(`docker-compose -p ${this.envName} -f "${this.pathToDockerCompose}" logs -f writer`);
          this.testLogger = t.log;
          // @ts-ignore
          logP.stdout.on('data', (data) => {
              if (this.testLogger) this.testLogger(data);
          });
          logP.on('exit', () => {
              if (this.testLogger) this.testLogger(`writer log exited`);
          });
      });

      test.serial.before((t) => t.log('[E2E] driver launchServices() finished'));
  }

  // inspired by https://github.com/applitools/docker-compose-mocha/blob/master/lib/get-logs-for-service.js
  async catJsonInService(serviceName: string, filePath: string) {
    return await retry(
      async () => {
        const data = (
          await execPromise(
            `docker-compose -p ${this.envName} -f "${this.pathToDockerCompose}" exec -T ${serviceName} cat "${filePath}"`
          )
        ).stdout;
        return JSON.parse(data);
      },
      { retries: 100, delay: 300 }
    );
  }

  async fetchText(serviceName: string, port: number, path: string) {
    const addr = await getAddressForService(this.envName, this.pathToDockerCompose, serviceName, port);
    return await retry(
      async () => {
        const url = `http://${addr}/${path}`;
        this.testLogger(`fetching ${url}`);
        const response = await fetch(url);
        return await response.text();
      },
      { retries: 10, delay: 300 }
    );
  }

  async fetchJson(path: string) : Promise<any> {
      const text = await this.fetchText('app', this.getAppConfig().Port, path);
      try {
        return JSON.parse(text);
      }catch (e) {
          throw new Error(`error parsing json: ${text}`);
      }
  }

  async writerLog(text: string) : Promise<number> {
    const addr = await getAddressForService(this.envName, this.pathToDockerCompose, 'writer', 8080);
    return await retry(
        async () => {
          const url = `http://${addr}/`;
          this.testLogger(`writing to log files: ${text}`);
          const res = await fetch(url, {method: 'POST', body: text});
          return res.status;
        },
        { retries: 10, delay: 300 }
    );
  }
}

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
