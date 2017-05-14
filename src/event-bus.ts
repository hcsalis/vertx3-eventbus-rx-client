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

  /**
   * Factory method to create an Rxified EventBus instance.
   *
   * @static
   * @param {string} url Server URL
   * @param {Options} [options] EventBus and SockJS options.  Refer to SockJS docs for other available options.
   * @returns {EventBus}
   *
   * @memberof EventBus
   */
  static create(url: string, options?: Options): EventBus {
    const delegate = new EB(url, options);
    return new EventBus(delegate);
  }

  /**
   * Wrapped non-Rxified EventBus instance.
   *
   * @type {*}
   * @memberof EventBus
   */
  delegate: any;

  /**
   * Default EventBus message headers.
   *
   * @type {*}
   * @memberof EventBus
   */
  get defaultHeaders(): any {
    return this.delegate.defaultHeaders;
  }

  set defaultHeaders(headers: any) {
    this.delegate.defaultHeaders = headers;
  }

  /**
   * Observable stream of the state.
   * - emits current state immediately upon subscription.
   * - completes when state is CLOSED.
   * @type {Observable<State>}
   * @memberof EventBus
   */
  state$: Observable<State>;

  /**
   * Current state
   *
   * @readonly
   * @type {State}
   * @memberof EventBus
   */
  get state(): State {
    return this.delegate.state;
  }

  /**
   * Close event emitted by the underlying SockJS connection.
   *
   * @readonly
   * @type {(CloseEvent | null)}
   * @memberof EventBus
   */
  get closeEvent(): CloseEvent | null {
    return this._closeEvent;
  }
  private _closeEvent: CloseEvent | null = null;

  /**
   * Creates an instance of Rxified EventBus.
   * This is useful if you have to wrap an existing non-Rxified EventBus instance. Otherwise, use the static factory method to create an instance.
   * @param {*} delegate non-Rxified EventBus instance
   *
   * @memberof EventBus
   */
  constructor(delegate: any) {
    this.delegate = delegate;
    // capture close event
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

  /**
   * Send a message without expecting a reply.
   *
   * @param {string} address
   * @param {*} message
   * @param {*} [headers]
   *
   * @memberof EventBus
   */
  send(address: string, message: any, headers?: any) {
    this.delegate.send(address, message, headers);
  }

  /**
   * Send a message and expect a reply. Returned observable:
   * - waits until subscription to send the message.
   * - emits the received reply message.
   * - errors when receives an error reply.
   * - completes after emitting the reply, or on EventBus close.
   * @param {string} address
   * @param {*} message
   * @param {*} [headers]
   * @returns {Observable<Message<any>>}
   *
   * @memberof EventBus
   */
  rxSend(address: string, message: any, headers?: any): Observable<Message<any>> {
    const generatorFn = Observable.bindNodeCallback<string, any, (any | undefined), Message<any>>(this.delegate.send.bind(this.delegate));
    return generatorFn(address, message, headers)
      .map(this._appendReplyFns)
      .takeUntil(this._stateClosedEvent$);
  }

  /**
   * Publish a message.
   *
   * @param {string} address
   * @param {*} message
   * @param {*} [headers]
   *
   * @memberof EventBus
   */
  publish(address: string, message: any, headers?: any) {
    this.delegate.publish(address, message, headers);
  }

  /**
   * Registers a message consumer on the EventBus. Returned observable:
   * - waits until subscription to register the consumer.
   * - unregisters consumer when unsubscribed.
   * - emits received messages.
   * - completes on EventBus close.
   * @param {string} address
   * @param {*} [headers]
   * @returns {Observable<Message<any>>}
   *
   * @memberof EventBus
   */
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

  /**
   * Close the EventBus and underlying SockJS connection.
   *
   * @memberof EventBus
   */
  close() {
    this.delegate.close();
  }

  /**
   * Enable or disable EventBus pings.
   * @param {boolean} enabled
   *
   * @memberof EventBus
   */
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
