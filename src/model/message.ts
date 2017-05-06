import { Observable } from 'rxjs/Observable';
import { Event } from './event';

export interface Message<T = any> extends Event {
  type: 'publish' | 'send';
  replyAddress?: string;
  headers?: object;
  body?: T;
  reply?: (message: any, headers?: object) => void;
  rxReply?: <R>(message: any, headers?: object) => Observable<Message<R>>;
}
