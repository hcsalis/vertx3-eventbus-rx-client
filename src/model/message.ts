import { Observable } from 'rxjs/Observable';

export interface Message<T> {
  address: string;
  replyAddress?: string;
  headers?: any;
  body?: T;
  reply?: (message: any, headers?: any) => void;
  rxReply?: (message: any, headers?: any) => Observable<Message<any>>;
}
