import * as Rx from 'rxjs/Rx';
import { CloseEvent } from '../../src/model/close-event';
import { State } from '../../src/model/state';

const Observable = Rx.Observable;

export function getNoop() {
  return (...args: any[]) => {
    // noop
  };
}

export function callFn(fn: () => any) {
  fn();
}

export function getCloseEvent(wasClean: boolean): CloseEvent {
  return {
    code: 12345,
    reason: `[dummy close event] wasClean: ${wasClean}`,
    wasClean,
  };
}

export function countDone(done: MochaDone, count: number) {
  return (error?: any) => {
    if (error) {
      done(error);
      return;
    }
    if (--count <= 0) {
      done();
    }
  };
}

export async function getEmissions<T = any>(obs: Rx.Observable<T>) {
  return obs.materialize().toArray().toPromise();
}

export async function notifyOnState(state$: Rx.Observable<State>, expected: State) {
  return state$.takeWhile(state => state !== expected).ignoreElements().toPromise();
}
