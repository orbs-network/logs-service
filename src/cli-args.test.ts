import test from 'ava';
import mockFs from 'mock-fs';
import { parseArgs } from './cli-args';
import _ from 'lodash';
import { exampleConfig } from './config.example';

test.serial.afterEach.always(() => {
  mockFs.restore();
});

test.serial('parseArgs default config file does not exist', (t) => {
  t.throws(() => parseArgs([]));
});

test.serial('parseArgs default config file valid', (t) => {
  mockFs({
    ['./config.json']: JSON.stringify(exampleConfig),
  });
  t.deepEqual(parseArgs([]), exampleConfig);
});

test.serial('parseArgs custom config file does not exist', (t) => {
  t.throws(() => parseArgs(['--config', './some/file.json']));
});

test.serial('parseArgs custom config file valid', (t) => {
  mockFs({
    ['./some/file.json']: JSON.stringify(exampleConfig),
  });
  t.deepEqual(parseArgs(['--config', './some/file.json']), exampleConfig);
});

test.serial('parseArgs two valid custom config files merged', (t) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mergedConfig: any = _.cloneDeep(exampleConfig);
  mergedConfig.SomeField = 'some value';
  mockFs({
    ['./first/file1.json']: JSON.stringify({ SomeField: 'some value' }),
    ['./second/file2.json']: JSON.stringify(exampleConfig),
  });
  t.deepEqual(parseArgs(['--config', './first/file1.json', './second/file2.json']), mergedConfig);
});

test.serial('parseArgs custom config file invalid JSON format', (t) => {
  mockFs({
    ['./some/file.json']: JSON.stringify(exampleConfig) + '}}}',
  });
  t.throws(() => parseArgs(['--config', './some/file.json']));
});

test.serial('parseArgs custom config file negative Port', (t) => {
  const partialConfig = _.cloneDeep(exampleConfig);
  partialConfig.Port = -1;
  mockFs({
    ['./some/partial.json']: JSON.stringify(partialConfig),
  });
  t.throws(() => parseArgs(['--config', './some/partial.json']));
});
