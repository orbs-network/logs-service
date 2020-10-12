import test from 'ava';
import mockFs from 'mock-fs';
import { writeStatusToDisk } from './status';
import { State } from './model/state';
import { readFileSync } from 'fs';
import { exampleConfig } from './config.example';
import { isNumber } from 'lodash';

test.serial.afterEach.always(() => {
  mockFs.restore();
});

test.serial('updates and writes Timestamp', async (t) => {
  const state = new State();
  mockFs({ ['./status/status.json']: '' });
  await writeStatusToDisk('./status/status.json', state, exampleConfig);

  const writtenContents = JSON.parse(readFileSync('./status/status.json').toString());
  t.log('result:', JSON.stringify(writtenContents, null, 2));

  t.assert(new Date().getTime() - new Date(writtenContents.Timestamp).getTime() < 1000);
});

test.serial('contains all payload fields', async (t) => {
  const state = new State();
  mockFs({ ['./status/status.json']: '' });
  await writeStatusToDisk('./status/status.json', state, exampleConfig);

  const writtenContents = JSON.parse(readFileSync('./status/status.json').toString());
  t.log('result:', JSON.stringify(writtenContents, null, 2));

  t.true('MemoryBytesUsed' in writtenContents.Payload);
  t.true('OpenFiles' in writtenContents.Payload);
  t.true('Config' in writtenContents.Payload);
  t.true('Services' in writtenContents.Payload);
  t.true('TailsActive' in writtenContents.Payload);

  t.true(isNumber(writtenContents.Payload.MemoryBytesUsed));
  t.true(isNumber(writtenContents.Payload.OpenFiles));
  t.deepEqual(exampleConfig, writtenContents.Payload.Config);
});

test.serial('displays error if one is passed to it', async (t) => {
  const state = new State();
  mockFs({ ['./status/status.json']: '' });
  const err = new Error('oh no!');
  await writeStatusToDisk('./status/status.json', state, exampleConfig, err);

  const writtenContents = JSON.parse(readFileSync('./status/status.json').toString());
  t.log('result:', JSON.stringify(writtenContents, null, 2));

  t.assert(writtenContents.Error.includes('oh no!'));
});
