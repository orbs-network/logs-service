import { getCurrentClockTime } from '../helpers';
import { ChildProcess } from 'child_process';

export interface RotationState {
  mapping: { [id: string]: number };
}

export interface Tailer {
  start: Date;
  end: Date;
  childProcess: ChildProcess;
  requestHeaders: string[];
  bytesRead: number;
}

export class State {
  // serializable objects (uppercase)
  Services: { [id: string]: RotationState } = {};

  ActiveTails: Tailer[] = [];

  TerminatedTails: Tailer[] = [];

  // not updated
  ServiceLaunchTime = getCurrentClockTime(); // UTC seconds

  // non-serializable objects (lowercase)
}
