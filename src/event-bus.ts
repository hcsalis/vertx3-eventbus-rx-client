import 'rxjs/add/observable/bindNodeCallback';
import 'rxjs/add/observable/fromEvent';
import 'rxjs/add/observable/fromEventPattern';
import 'rxjs/add/observable/of';
import 'rxjs/add/operator/concat';
import 'rxjs/add/operator/first';
import 'rxjs/add/operator/ignoreElements';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/takeUntil';
import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import { Subscription } from 'rxjs/Subscription';
import * as EB from 'vertx3-eventbus-client';
import { CloseEvent } from './model/close-event';
import { Message } from './model/message';
import { Options } from './model/options';
import { State } from './model/state';

export class EventBus {
  static create(url: string, options?: Options) {
    const delegate = new EB(url, options);
    return new EventBus(delegate);
  }

  state$: Observable<State>;

  get state(): State {
    return this.delegate.state;
  }

  get defaultHeaders(): any {
    return this.delegate.defaultHeaders;
  }

  set defaultHeaders(headers: any) {
    this.delegate.defaultHeaders = headers;
  }

  private _closeEvent: CloseEvent | null = null;

  constructor(public delegate: any) {
    this.state$ = this._createStateStream(delegate, () => this._closeEvent);
    // capture close event to pass it to future state subscriptions
    this.state$
      .ignoreElements()
      .subscribe({ error: closeEvent => this._closeEvent = closeEvent });
  }

  send(address: string, message: any, headers?: any) {
    this.delegate.send(address, message, headers);
  }

  rxSend(address: string, message: any, headers?: any) {
    const generatorFn = Observable.bindNodeCallback<string, any, (object | undefined), Message<any>>(this.delegate.send.bind(this.delegate));
    return generatorFn(address, message, headers)
      .map(this._appendReplyFns)
      .takeUntil(this._createCompleteNotifier(this.state$));
  }

  publish(address: string, message: any, headers?: any) {
    this.delegate.publish(address, message, headers);
  }

  rxConsumer(address: string, headers?: any) {
    return Observable.fromEventPattern(
      handler => {
        this.delegate.registerHandler(address, headers, handler);
      },
      handler => {
        if (this.state === State.OPEN) {
          this.delegate.unregisterHandler(address, headers, handler);
        }
      },
      (err, msg) => {
        if (err) {
          throw err;
        }
        return msg;
      })
      .map<Message<any>, Message<any>>(this._appendReplyFns)
      .takeUntil(this._createCompleteNotifier(this.state$));
  }

  close() {
    this.delegate.close();
  }

  setPingEnabled(enabled: boolean) {
    this.delegate.pingEnabled(enabled);
  }

  private _appendReplyFns = <T>(msg: Message<T>): Message<T> => {
    const replyAddress = msg.replyAddress;
    if (!replyAddress) {
      return msg;
    }
    return {
      ...msg,
      reply: (message: any, headers?: any) => {
        this.send(replyAddress, message, headers);
      },
      rxReply: (message: any, headers?: any) => {
        return this.rxSend(replyAddress, message, headers);
      },
    };
  }

  private _createStateStream(delegate: any, getCloseEvent: () => CloseEvent | null): Observable<State> {
    // add event listeners on sockjs instead of the delegate to preserve delegate's existing event handlers.
    return Observable
      .create((observer: Observer<State>) => {
        observer.next(delegate.state);
        if (delegate.state === State.CLOSED) {
          if (getCloseEvent()) {
            observer.error(this._closeEvent);
          } else {
            observer.complete();
          }
          return undefined;
        }
        const subs = new Subscription();
        if (delegate.state === State.CONNECTING) {
          const openSub = Observable
            .fromEvent<State>(delegate.sockJSConn, 'open')
            .first()
            .subscribe(() => {
              observer.next(State.OPEN);
            });
          subs.add(openSub);
        }
        const closeSub = Observable
          .fromEvent<CloseEvent>(delegate.sockJSConn, 'close')
          .first()
          .subscribe(event => {
            observer.next(State.CLOSED);
            if (event.wasClean) {
              observer.complete();
            } else {
              observer.error(event);
            }
          });
        subs.add(closeSub);
        return new Subscription(() => {
          subs.unsubscribe();
        });
      });
  }

  /**
   * Creates a notifier observable to be used in conjunction with takeUntil operator.
   * Returned observable:
   * - Ignores all values emitted by source.
   * - When source completes, emits a dummy notification to notify takeUntil operator.
   * - When source errors, passes the same error.
   * @private
   * @param {Observable<any>} source observable
   * @returns {Observable<any>} A notifier observable to be used in conjunction with takeUntil operator.
   *
   * @memberof EventBus
   */
  private _createCompleteNotifier(source: Observable<any>) {
    return source
      .ignoreElements()
      .concat(Observable.of('complete notification'));
  }
}
