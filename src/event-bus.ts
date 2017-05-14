import 'rxjs/add/observable/bindNodeCallback';
import 'rxjs/add/observable/defer';
import 'rxjs/add/observable/empty';
import 'rxjs/add/observable/fromEvent';
import 'rxjs/add/observable/fromEventPattern';
import 'rxjs/add/observable/merge';
import 'rxjs/add/operator/first';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/mapTo';
import 'rxjs/add/operator/startWith';
import 'rxjs/add/operator/takeUntil';
import { Observable } from 'rxjs/Observable';
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

  get defaultHeaders(): any {
    return this.delegate.defaultHeaders;
  }

  set defaultHeaders(headers: any) {
    this.delegate.defaultHeaders = headers;
  }

  state$: Observable<State>;

  get state(): State {
    return this.delegate.state;
  }

  get closeEvent() {
    return this._closeEvent;
  }
  private _closeEvent: CloseEvent | null = null;

  constructor(public delegate: any) {
    // capture close event to pass it to future state subscriptions
    this._stateClosedEvent$.subscribe(
      event => this._closeEvent = event || null,
    );
    // init state$
    this.state$ = Observable.defer(() => {
      return Observable
        .merge(
        this._stateOpenEvent$.mapTo(State.OPEN).takeUntil(this._stateClosedEvent$),
        this._stateClosedEvent$.mapTo(State.CLOSED),
      )
        .startWith(delegate.state);
    });
  }

  send(address: string, message: any, headers?: any) {
    this.delegate.send(address, message, headers);
  }

  rxSend(address: string, message: any, headers?: any): Observable<Message<any>> {
    const generatorFn = Observable.bindNodeCallback<string, any, (object | undefined), Message<any>>(this.delegate.send.bind(this.delegate));
    return generatorFn(address, message, headers)
      .map(this._appendReplyFns)
      .takeUntil(this._stateClosedEvent$);
  }

  publish(address: string, message: any, headers?: any) {
    this.delegate.publish(address, message, headers);
  }

  rxConsumer(address: string, headers?: any): Observable<Message<any>> {
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
      .map(this._appendReplyFns)
      .takeUntil(this._stateClosedEvent$);
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

  private get _stateOpenEvent$() {
    if (this.state !== State.CONNECTING) {
      return Observable.empty<void>();
    }
    return Observable
      .fromEvent<void>(this.delegate.sockJSConn, 'open')
      .first();
  }

  private get _stateClosedEvent$() {
    if (this.state === State.CLOSED) {
      return Observable.empty<CloseEvent>();
    }
    return Observable
      .fromEvent<CloseEvent>(this.delegate.sockJSConn, 'close')
      .first();
  }
}
