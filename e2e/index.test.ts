import test from 'ava';
import { TestEnvironment } from './driver';
import { join } from 'path';
import { sleep } from '../src/helpers';
import { deepDataMatcher, isPositiveNumber } from './deep-matcher';
import { mkdirSync, writeFileSync } from 'fs';

const driver = new TestEnvironment(join(__dirname, 'docker-compose.yml'));
driver.launchServices();

test.serial('[E2E] service is up, and writing status file', async (t) => {
  t.log('started');
  driver.testLogger = t.log;
  t.timeout(60 * 1000);

  await sleep(1000);

  const status = await driver.catJsonInService('app', '/opt/orbs/status/status.json');
  t.log('status:', JSON.stringify(status, null, 2));

  const errors = deepDataMatcher(status.Payload, {
    MemoryBytesUsed: isPositiveNumber,
  });
  t.deepEqual(errors, []);
});

test.serial('[E2E] serving status over http', async (t) => {
  t.log('started');
  driver.testLogger = t.log;
  t.timeout(60 * 1000);

  await sleep(1000);
  t.log(`Port`, driver.getAppConfig().Port);

  const status = await driver.fetch('app', driver.getAppConfig().Port, `status`);
  t.log('status:', JSON.stringify(status, null, 2));

  const errors = deepDataMatcher(status.Payload, {
    MemoryBytesUsed: isPositiveNumber,
  });
  t.deepEqual(errors, []);
});

test.serial('[E2E] serve one line of logs', async (t) => {
  t.log('started');
  driver.testLogger = t.log;

  // write some logs:
  const logPath = driver.resetLogDir('aService');
  writeFileSync(join(logPath, 'current'), 'some log line');

  t.timeout(60 * 1000);

  await sleep(1000);
  t.log(`Port`, driver.getAppConfig().Port);

  const descriptor = await driver.fetch('app', driver.getAppConfig().Port, `logs/aService`);
  t.log('status:', JSON.stringify(descriptor, null, 2));

  t.truthy(Array.isArray(descriptor) && descriptor.length === 1);
  const errors = deepDataMatcher(descriptor[0], {
    fileName: 'current',
    batchSize: 13,
    id: 1,
  });

  t.deepEqual(errors, []);
  t.log(JSON.stringify(descriptor, null, 2));
});

// TODO add happy flow test for each one of the API scenarios. for this, figure out a way to run multilog from the e2e to control rotation
