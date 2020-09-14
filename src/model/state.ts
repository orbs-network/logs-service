import { getCurrentClockTime } from '../helpers';

export interface rotationState {
  currentBatchNumber: number;
  currentHighestDisplayBatchNumber: number;
  currentBatchesSnapshotStringfied: string;
}

export class State {
  // serializable objects (uppercase) 
  Services: { [id: string]: rotationState } = {};

  // not updated
  ServiceLaunchTime = getCurrentClockTime(); // UTC seconds

  // non-serializable objects (lowercase)
}
