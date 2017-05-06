import 'rxjs/add/observable/bindNodeCallback';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/takeUntil';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import { Subscription } from 'rxjs/Subscription';
import * as EB from 'vertx3-eventbus-client';
import { Error } from './model/error';
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
    return this._stateSource.getValue();
  }

  get defaultHeaders(): object {
    return this.delegate.defaultHeaders;
  }

  set defaultHeaders(headers: object) {
    this.delegate.defaultHeaders = headers;
  }

  private _stateSource: BehaviorSubject<State>;
  private _stateNotOpenNotifier: Observable<any>;

  constructor(public delegate: any) {
    this._stateSource = new BehaviorSubject<State>(delegate.state);
    this.state$ = this._stateSource.asObservable();
    this._stateNotOpenNotifier = this.state$.filter(state => state !== State.OPEN);
    this.delegate.onopen = () => {
      this._stateSource.next(State.OPEN);
    };
    this.delegate.onclose = (err: any) => {
      this._stateSource.next(State.CLOSED);
      if (err) {
        this._stateSource.error(err);
      } else {
        this._stateSource.complete();
      }
    };
  }

  send(address: string, message: any, headers?: object) {
    this.delegate.send(address, message, headers);
  }

  rxSend<T = any>(address: string, message: any, headers?: object): Observable<Message<T>> {
    const generatorFn = Observable.bindNodeCallback<string, any, (object | undefined), Message<T>>(this.delegate.send);
    return generatorFn(address, message, headers)
      .map(this._appendReplyFns)
      .takeUntil(this._stateNotOpenNotifier);
  }

  publish(address: string, message: any, headers?: object) {
    this.delegate.publish(address, message, headers);
  }

  rxConsumer<T = any>(address: string, headers?: object): Observable<Message<T>> {
    return Observable
      .create((observer: Observer<Message<T>>) => {
        const handler = (err: Error, message: Message<T>) => {
          if (err) {
            observer.error(err);
          } else {
            observer.next(message);
          }
        };
        this.delegate.registerHandler(address, headers, handler);
        return new Subscription(() => {
          if (this.state === State.OPEN) {
            this.delegate.unregisterHandler(address, headers, handler);
          }
        });
      })
      .map(this._appendReplyFns)
      .takeUntil(this._stateNotOpenNotifier);
  }

  close() {
    this._stateSource.next(State.CLOSING);
    this.delegate.close();
  }

  setPingEnabled(enabled: boolean) {
    this.delegate.pingEnabled(enabled);
  }

  private _appendReplyFns = (msg: Message): Message => {
    if (!msg.replyAddress) {
      return msg;
    }
    const replyAddress = msg.replyAddress;
    return {
      ...msg,
      reply: (message: any, headers?: object) => {
        this.send(replyAddress, message, headers);
      },
      rxReply: <T = any>(message: any, headers?: object): Observable<Message<T>> => {
        return this.rxSend<T>(replyAddress, message, headers);
      },
    };
  }
}
