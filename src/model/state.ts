import { getCurrentClockTime } from '../helpers';

export class State {
  // serializable objects (uppercase)

  // not updated
  ServiceLaunchTime = getCurrentClockTime(); // UTC seconds

  // non-serializable objects (lowercase)
}
