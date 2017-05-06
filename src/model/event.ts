/**
 * @internal
 */
export interface Event {
  type: 'publish' | 'send' | 'register' | 'unregister' | 'ping' | 'err';
  address: string;
}
