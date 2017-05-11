import * as chai from 'chai';
import * as Rx from 'rxjs/Rx';
import { ColdObservable } from 'rxjs/testing/ColdObservable';
import { HotObservable } from 'rxjs/testing/HotObservable';
import { SubscriptionLog } from 'rxjs/testing/SubscriptionLog';
import { observableToBeFn, subscriptionLogsToBeFn, TestScheduler } from 'rxjs/testing/TestScheduler';

export class RxMarbleHelper {

  static run(test: (globals: RxMarbleHelper) => void) {
    const helper = new RxMarbleHelper();
    test(helper);
    helper.flush();
  }

  private rxTestScheduler: Rx.TestScheduler;
  constructor() {
    this.rxTestScheduler = new Rx.TestScheduler((actual: any, expected: any) => {
      chai.assert.deepEqual(actual, expected);
    });
  }

  hot = (marbles: string, values?: any, error?: any): HotObservable<any> => {
    return this.rxTestScheduler.createHotObservable.call(this.rxTestScheduler, marbles, values, error);
  }
  cold = (marbles: string, values?: any, error?: any): ColdObservable<any> => {
    return this.rxTestScheduler.createColdObservable.call(this.rxTestScheduler, marbles, values, error);
  }
  expectObservable = (observable: Rx.Observable<any>, unsubscriptionMarbles?: string): { toBe: observableToBeFn } => {
    return this.rxTestScheduler.expectObservable.call(this.rxTestScheduler, observable, unsubscriptionMarbles);
  }
  expectSubscriptions = (actualSubscriptionLogs: SubscriptionLog[]): { toBe: subscriptionLogsToBeFn } => {
    return this.rxTestScheduler.expectSubscriptions.call(this.rxTestScheduler, actualSubscriptionLogs);
  }
  time = (marbles: string): number => {
    return this.rxTestScheduler.createTime.call(this.rxTestScheduler, marbles);
  }
  flush = () => {
    this.rxTestScheduler.flush();
  }
}
