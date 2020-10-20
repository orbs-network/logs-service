import test from 'ava';
import { sleep, TestEnvironment } from './driver';
import { join } from 'path';
import {deepDataMatcher, isNonEmptyString, isNonNegativeNumber, isPositiveNumber, isValidImageVersion} from './deep-matcher';

const driver = new TestEnvironment(join(__dirname, 'docker'));
driver.launchServices();

test.serial('[E2E] service is up, and writing status file', async (t) => {
  t.log('started');
  driver.testLogger = t.log;
  t.timeout(60 * 1000);

  await sleep(1000);

  const status = await driver.catJsonInService('app', '/opt/orbs/status/status.json');
  t.log('status:', JSON.stringify(status, null, 2));

  const errors = deepDataMatcher(status.Payload, statusPayloadTemplate);
  t.deepEqual(errors, []);
});

test.serial('[E2E] serving status over http', async (t) => {
  t.log('started');
  driver.testLogger = t.log;

  t.timeout(60 * 1000);

  await sleep(1000);
  const status = await driver.fetchJson(`status`);

  t.log('status:', JSON.stringify(status, null, 2));
  const errors = deepDataMatcher(status.Payload, statusPayloadTemplate);
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

test.serial('[E2E] tails new logs', async (t) => {
  t.log('started');
  driver.testLogger = t.log;

  t.timeout(60 * 1000);

  await driver.writerLog('some lines we missed earlier...');

  let tailed = '';
  const response = await driver.fetchTextAsync(`logs/aService/tail`);
  response.body.on('data', (b) => {
    tailed += b.toString();
  });

  await sleep(2000); // let mapping/housekeeping run once on server

  const data = 'startData\n' + 'blockLine\n'.repeat(400) + 'endData';
  t.deepEqual(await driver.writerLog(data), 200);

  while (tailed.indexOf('endData') === -1) {
    await sleep(500);
  }

  t.log('read all new lines in tail across several files');
});

test.serial('[E2E] get batches with options', async (t) => {
  t.log('started');
  driver.testLogger = t.log;

  t.timeout(60 * 1000);

  const batches = await driver.fetchJson('logs/aService');
  t.truthy(batches.length > 1, 'expected there to be several batches after prev tests');

  // expect list to be sorted by id in descending order:
  for (let i = 0; i < batches.length; i++) {
    t.truthy((batches[i].id = batches[0].id - i));
  }

  // download current
  const curr = await driver.fetchText(`logs/aService/batch/${batches[0].id}`);
  t.deepEqual(curr.length, batches[0].batchSize);

  // download prev
  const prev = await driver.fetchText(`logs/aService/batch/${batches[1].id}`);
  t.deepEqual(prev.length, batches[1].batchSize);

  // download prev with follow - should have no effect and return immediately
  const prevFollow = await driver.fetchText(`logs/aService/batch/${batches[1].id}?follow`);
  t.deepEqual(prevFollow, prev);

  // download current with start
  const currStart1 = await driver.fetchText(`logs/aService/batch/${batches[0].id}?start=1`);
  t.deepEqual(currStart1, curr, 'expected length to reflect skipping bytes');
  const currStart2 = await driver.fetchText(`logs/aService/batch/${batches[0].id}?start=2`);
  t.deepEqual(currStart2, curr.slice(1), 'expected length to reflect skipping bytes');

  // download prev with start
  const prevStart1 = await driver.fetchText(`logs/aService/batch/${batches[1].id}?start=1`);
  t.deepEqual(prevStart1, prev, 'expected length to reflect skipping bytes');
  const prevStart2 = await driver.fetchText(`logs/aService/batch/${batches[1].id}?start=2`);
  t.deepEqual(prevStart2, prev.slice(1), 'expected length to reflect skipping bytes');
  const prevStart2follow = await driver.fetchText(`logs/aService/batch/${batches[1].id}?start=2&follow`);
  t.deepEqual(prevStart2follow, prevStart2);

  // download current with follow
  let responseFollow = '';
  let responseFollowStart2 = '';
  const responseNoOffset = await driver.fetchTextAsync(`logs/aService/batch/${batches[0].id}?follow`);
  responseNoOffset.body.on('data', (b) => {
    responseFollow += b.toString();
  });
  const responseStart2 = await driver.fetchTextAsync(`logs/aService/batch/${batches[0].id}?start=2&follow`);
  responseStart2.body.on('data', (b) => {
    responseFollowStart2 += b.toString();
  });

  await sleep(1000);
  const addedText = 'add some text while following';
  await driver.writerLog(addedText);

  while (responseFollow.length !== curr.length + addedText.length + 1) {
    await sleep(500);
  }

  while (responseFollowStart2.length !== currStart2.length + addedText.length + 1) {
    await sleep(500);
  }

  t.deepEqual(responseFollow, curr + addedText + '\n');
  t.deepEqual(responseFollowStart2, currStart2 + addedText + '\n');
});

const statusPayloadTemplate = {
  Uptime: isNonNegativeNumber,
  MemoryBytesUsed: isPositiveNumber,
  Version: {
    Semantic: isValidImageVersion,
  },
  OpenFiles: isNonNegativeNumber,
  Config: {},
  Services: {},
  TailsActive: {},
  TailsTerm: {},
};
