import test from 'ava';
import _ from 'lodash';
import { validateConfiguration } from './config';
import { exampleConfig } from './config.example';

test('validateConfiguration works on valid config', (t) => {
  t.notThrows(() => validateConfiguration(exampleConfig));
});

test('validateConfiguration fails on invalid Port', (t) => {
  const invalidConfig = _.cloneDeep(exampleConfig);
  invalidConfig.Port = -1;
  t.throws(() => validateConfiguration(invalidConfig));
});

test('validateConfiguration fails on zero status update interval', (t) => {
  const invalidConfig = _.cloneDeep(exampleConfig);
  invalidConfig.StatusUpdateLoopIntervalSeconds = 0;
  t.throws(() => validateConfiguration(invalidConfig));
});

test('validateConfiguration fails on negative status update interval', (t) => {
  const invalidConfig = _.cloneDeep(exampleConfig);
  invalidConfig.StatusUpdateLoopIntervalSeconds = -1;
  t.throws(() => validateConfiguration(invalidConfig));
});

test('validateConfiguration fails on missing status path', (t) => {
  const invalidConfig = _.cloneDeep(exampleConfig);
  invalidConfig.StatusJsonPath = '';
  t.throws(() => validateConfiguration(invalidConfig));
});

test('validateConfiguration fails on missing logs path', (t) => {
  const invalidConfig = _.cloneDeep(exampleConfig);
  delete invalidConfig.LogsPath;
  t.throws(() => validateConfiguration(invalidConfig));
});

test('validateConfiguration fails on empty logs path', (t) => {
  const invalidConfig = _.cloneDeep(exampleConfig);
  invalidConfig.LogsPath = '';
  t.throws(() => validateConfiguration(invalidConfig));
});
