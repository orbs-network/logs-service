import test from 'ava';
import {sleep, TestEnvironment} from './driver';
import { join } from 'path';
import { deepDataMatcher, isPositiveNumber } from './deep-matcher';

const driver = new TestEnvironment(join(__dirname, 'docker'));
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

  const status = await driver.fetchJson(`status`);
  t.log('status:', JSON.stringify(status, null, 2));

  const errors = deepDataMatcher(status.Payload, {
    MemoryBytesUsed: isPositiveNumber,
  });
  t.deepEqual(errors, []);
});

test.serial('[E2E] get logs summary', async (t) => {
  t.log('started');
  driver.testLogger = t.log;

  t.timeout(60 * 1000);

  // write some logs:
  const logData = 'some log line';
  const expectedBatchSize = logData.length + "\n".length;

  // let accumulatedLogSize = 0;
  // while (accumulatedLogSize < 1024) {
  //   const postRes = await driver.writerLog(logData);
  //   t.deepEqual(postRes, 200);
  //   accumulatedLogSize += expectedBatchSize;
  // }
  // t.log('wrote log:', accumulatedLogSize);

  const postRes = await driver.writerLog(logData);
  t.deepEqual(postRes, 200);

  // TODO FLAKY
  await sleep(1000);

  const descriptor = await driver.fetchJson(`logs/aService`);
  t.log('logs descriptor:', JSON.stringify(descriptor, null, 2));

  t.truthy(Array.isArray(descriptor) && descriptor.length === 1);
  const errors = deepDataMatcher(descriptor[0], {
    fileName: 'current',
    batchSize: isPositiveNumber,
    id: 1,
  });

  t.deepEqual(errors, []);  
});

async function waitUntilServiceFound(t: any, serviceName: string) : Promise<any> {
  let status: any;
  while (
      status === undefined ||
      status.Services === undefined ||
      status.Services[serviceName] === undefined ) {
    try {
      status = (await driver.fetchJson(`status`));
      t.log('status', JSON.stringify(status));
    } catch (e) {
      t.log('status unavailable', e);
      await sleep(100);
    }
  }
  return status.Services;
}

// TODO add happy flow test for each one of the API scenarios.
