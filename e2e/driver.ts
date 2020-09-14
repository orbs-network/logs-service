import test from 'ava';
import { dockerComposeTool, getAddressForService } from 'docker-compose-mocha';
import { unlinkSync, writeFileSync } from 'fs';
import { exec } from 'child_process';
import { exec as execPromise } from 'child-process-promise';
import { retry } from 'ts-retry-promise';
import { join } from 'path';
import fetch from 'node-fetch';
import { defaultConfiguration } from '../src/config';

export class TestEnvironment {
  private envName: string = '';
  public testLogger: (lines: string) => void = (_: string) => {}; // silent by default

  constructor(private pathToDockerCompose: string) {}

  getAppConfig() {
    return defaultConfiguration;
  }

  // runs all the docker instances with docker-compose
  launchServices() {
    test.serial.before((t) => t.log('[E2E] driver launchServices() start'));

    // step 1 - write config file for app
    test.serial.before((t) => {
      t.log('[E2E] write config file for app');
      const configFilePath = join(__dirname, 'app-config.json');
      try {
        unlinkSync(configFilePath);
      } catch (err) {}
      const config = this.getAppConfig();
      writeFileSync(configFilePath, JSON.stringify(config));
    });

    // step 2 - launch service docker
    test.serial.before((t) => t.log('[E2E] launch app docker'));
    this.envName = dockerComposeTool(
      test.serial.before.bind(test.serial),
      test.serial.after.always.bind(test.serial.after),
      this.pathToDockerCompose,
      {
        startOnlyTheseServices: ['app'],
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
      { retries: 10, delay: 300 }
    );
  }

  async fetch(serviceName: string, port: number, path: string) {
    const addr = await getAddressForService(this.envName, this.pathToDockerCompose, serviceName, port);
    return await retry(
      async () => {
        const url = `http://${addr}/${path}`;
        this.testLogger(`fetching ${url}`);
        const response = await fetch(url);
        const body = await response.text();
        try {
          return JSON.parse(body);
        } catch (e) {
          throw new Error(`invalid response: \n${body}`);
        }
      },
      { retries: 10, delay: 300 }
    );
  }
}
