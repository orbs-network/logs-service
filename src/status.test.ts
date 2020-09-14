import test from 'ava';
import mockFs from 'mock-fs';
import { writeStatusToDisk } from './status';
import { State } from './model/state';
import { readFileSync } from 'fs';
import { exampleConfig } from './config.example';

test.serial.afterEach.always(() => {
  mockFs.restore();
});

test.serial('updates and writes Timestamp', (t) => {
  const state = new State();
  mockFs({ ['./status/status.json']: '' });
  writeStatusToDisk('./status/status.json', state, exampleConfig);

  const writtenContents = JSON.parse(readFileSync('./status/status.json').toString());
  t.log('result:', JSON.stringify(writtenContents, null, 2));

  t.assert(new Date().getTime() - new Date(writtenContents.Timestamp).getTime() < 1000);
});

test.serial('contains all payload fields', (t) => {
  const state = new State();
  mockFs({ ['./status/status.json']: '' });
  writeStatusToDisk('./status/status.json', state, exampleConfig);

  const writtenContents = JSON.parse(readFileSync('./status/status.json').toString());
  t.log('result:', JSON.stringify(writtenContents, null, 2));

  t.deepEqual(writtenContents.Payload, {
    Uptime: 0,
    MemoryBytesUsed: writtenContents.Payload.MemoryBytesUsed,
    Config: exampleConfig,
  });
});

test.serial('displays error if one is passed to it', (t) => {
  const state = new State();
  mockFs({ ['./status/status.json']: '' });
  const err = new Error('oh no!');
  writeStatusToDisk('./status/status.json', state, exampleConfig, err);

  const writtenContents = JSON.parse(readFileSync('./status/status.json').toString());
  t.log('result:', JSON.stringify(writtenContents, null, 2));

  t.assert(writtenContents.Error.includes('oh no!'));
});
