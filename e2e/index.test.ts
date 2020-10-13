import test from 'ava';
import { sleep, TestEnvironment } from './driver';
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

  await driver.writerLog('just a small string');
  let descriptor = await driver.fetchJson(`logs/aService`);

  t.truthy(Array.isArray(descriptor) && descriptor.length === 1);
  const errors = deepDataMatcher(descriptor[0], {
    fileName: 'current',
    batchSize: isPositiveNumber,
    id: 1,
  });
  t.deepEqual(errors, []);

  // write some logs:
  const logData = 'some log line' + `\nsome log line`.repeat(300);

  let postRes = await driver.writerLog(logData);
  t.deepEqual(postRes, 200);

  // After first rotation must wait for {StatusUpdateLoopIntervalSeconds} 
  await sleep(3000);

  const descriptorAfterRotation = await driver.fetchJson(`logs/aService`);
  t.log('logs descriptor after the rotation:', JSON.stringify(descriptorAfterRotation, null, 2));
  t.truthy(Array.isArray(descriptorAfterRotation) && descriptorAfterRotation.length > 1);
});

async function waitUntilServiceFound(t: any, serviceName: string): Promise<any> {
  let status: any;
  while (
    status === undefined ||
    status.Services === undefined ||
    status.Services[serviceName] === undefined) {
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
