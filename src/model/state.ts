import { getCurrentClockTime } from '../helpers';

export interface rotationState {
  mapping: { [id: string]: number };
}

export interface Tailer {
  processId: number;
  ip: string;
  path: string;
}

export class State {
  // serializable objects (uppercase) 
  Services: { [id: string]: rotationState } = {};

  ActiveTails: Tailer[] = [];

  // not updated
  ServiceLaunchTime = getCurrentClockTime(); // UTC seconds

  // non-serializable objects (lowercase)
}
