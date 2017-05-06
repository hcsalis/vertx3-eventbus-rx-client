import { Event } from './event';
export interface Error extends Event {
  type: 'err';
  failureCode: number;
  failureType: string;
  message: any;
}
