import test from 'ava';
import { TestEnvironment } from './driver';
import { join } from 'path';
import { sleep } from '../src/helpers';
import { deepDataMatcher, isPositiveNumber } from './deep-matcher';

const driver = new TestEnvironment(join(__dirname, 'docker-compose.yml'));
driver.launchServices();

test.serial('[E2E] service is up', async (t) => {
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
