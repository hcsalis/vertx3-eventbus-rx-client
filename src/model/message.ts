import { Observable } from 'rxjs/Observable';

export interface Message<T = any> {
  address: string;
  replyAddress?: string;
  headers?: object;
  body?: T;
  reply?: (message: any, headers?: object) => void;
  rxReply?: <R>(message: any, headers?: object) => Observable<Message<R>>;
}
