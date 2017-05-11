import { expect, use } from 'chai';
import { EventEmitter } from 'events';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { EventBus } from '../src';
import { CloseEvent } from '../src/model/close-event';
import { Error } from '../src/model/error';
import { Message } from '../src/model/message';
import { State } from '../src/model/state';
import { RxMarbleHelper } from './helpers/marble-testing';
import { callFn, getCloseEvent, getEmissions, getNoop } from './helpers/util';

use(sinonChai);

describe('EventBus', () => {
  describe('constructor', () => {
    it('should not override delegate event handlers', () => {
      const delegate = new FakeDelegate();
      delegate.onopen = getNoop();
      delegate.onclose = getNoop();
      const openSpy = sinon.spy(delegate, 'onopen');
      const closeSpy = sinon.spy(delegate, 'onclose');
      const eb = new EventBus(delegate);
      delegate.onopen();
      delegate.onclose();
      expect(openSpy).to.have.been.calledOnce;
      expect(closeSpy).to.have.been.calledOnce;
    });
  });

  describe('defaultHeaders', () => {
    it('should get delegate defaultHeaders', () => {
      const delegate = new FakeDelegate();
      const eb = new EventBus(delegate);
      delegate.defaultHeaders = { header1: 'header 1' };
      expect(eb.defaultHeaders).to.be.equal(delegate.defaultHeaders);
    });

    it('should set delegate defaultHeaders', () => {
      const delegate = new FakeDelegate();
      const eb = new EventBus(delegate);
      eb.defaultHeaders = { header1: 'header 1' };
      expect(eb.defaultHeaders).to.be.equal(delegate.defaultHeaders);
    });
  });

  describe('state', () => {
    it('should get current delegate state', () => {
      const delegate = new FakeDelegate();
      const eb = new EventBus(delegate);
      delegate.state = State.CLOSING;
      expect(eb.state).to.be.equal(delegate.state);
    });
  });

  describe('state$', () => {
    describe('when subscribed', () => {
      describe('when connection is not CLOSED', () => {
        it('should emit current state right after subscription', () => {
          RxMarbleHelper.run(({ expectObservable }) => {
            const delegate = new FakeDelegate();
            delegate.state = State.OPEN;
            const eb = new EventBus(delegate);
            expectObservable(eb.state$).toBe('a--', { a: State.OPEN });
          });
        });
      });
      describe('when connection is CLOSED', () => {
        describe('when close was clean', () => {
          it('should emit CLOSED and complete', () => {
            RxMarbleHelper.run(({ expectObservable }) => {
              const delegate = new FakeDelegate();
              const eb = new EventBus(delegate);
              // set to clean closed
              delegate.state = State.CLOSED;
              const closeEvent = getCloseEvent(true);
              delegate.sockJSConn.emit('close', closeEvent);
              expectObservable(eb.state$).toBe('(c|)', { c: State.CLOSED }, closeEvent);
            });
          });
        });
        // TODO remove
        describe('when close was not clean', () => {
          it('should emit CLOSED and error with close event', () => {
            RxMarbleHelper.run(({ expectObservable }) => {
              const delegate = new FakeDelegate();
              const eb = new EventBus(delegate);
              // set to dirty closed
              delegate.state = State.CLOSED;
              const closeEvent = getCloseEvent(false);
              delegate.sockJSConn.emit('close', closeEvent);
              expectObservable(eb.state$).toBe('(c#)', { c: State.CLOSED }, closeEvent);
            });
          });
        });
      });
    });
    describe('when already subscribed', () => {
      describe('when connection opens', () => {
        it('should emit OPEN', () => {
          RxMarbleHelper.run(({ cold, expectObservable }) => {
            const delegate = new FakeDelegate();
            const eb = new EventBus(delegate);
            const effects = {
              O: () => delegate.sockJSConn.emit('open'),
            };
            cold('--O', effects).do(callFn).subscribe();
            const values = {
              a: State.CONNECTING,
              b: State.OPEN,
            };
            expectObservable(eb.state$).toBe('a-(b)', values);
          });
        });
      });
      describe('when connection closes', () => {
        describe('when close is clean', () => {
          it('should emit CLOSED and complete', () => {
            RxMarbleHelper.run(({ cold, expectObservable }) => {
              const delegate = new FakeDelegate();
              const eb = new EventBus(delegate);
              const effects = {
                C: () => delegate.sockJSConn.emit('close', getCloseEvent(true)),
              };
              cold('--C', effects).do(callFn).subscribe();
              const values = {
                a: State.CONNECTING,
                c: State.CLOSED,
              };
              expectObservable(eb.state$).toBe('a-(c|)', values);
            });
          });
        });
        describe('when close is not clean', () => {
          it('should emit CLOSED and error with close event', () => {
            RxMarbleHelper.run(({ cold, expectObservable }) => {
              const delegate = new FakeDelegate();
              const eb = new EventBus(delegate);
              const closeEvent = getCloseEvent(false);
              const effects = {
                C: () => delegate.sockJSConn.emit('close', closeEvent),
              };
              cold('--C', effects).do(callFn).subscribe();
              const values = {
                a: State.CONNECTING,
                c: State.CLOSED,
              };
              expectObservable(eb.state$).toBe('a-(c#)', values, closeEvent);
            });
          });
        });
      });
    });
  });

  describe('send', () => {
    it('should call delegate.send with given parameters', () => {
      const delegate = new FakeDelegate();
      const eb = new EventBus(delegate);
      const stub = sinon.stub(delegate, 'send')
        .callsFake(getNoop());
      const address = 'test-address';
      const message = { test: 'message' };
      const headers = { test: 'headers' };
      eb.send(address, message, headers);
      expect(stub).to.have.been.calledWithExactly(address, message, headers);
    });
  });

  describe('rxSend', () => {
    describe('when not subscribed', () => {
      it('should not send message', () => {
        const delegate = new FakeDelegate();
        const eb = new EventBus(delegate);
        const sendSpy = sinon.spy(delegate, 'send');
        const obs = eb.rxSend('address', {});
        expect(sendSpy).to.not.have.been.called;
      });
    });
    describe('when subscribed', () => {
      it('should send message with supplied params', () => {
        const delegate = new FakeDelegate();
        const eb = new EventBus(delegate);
        const sendSpy = sinon.spy(delegate, 'send');

        const address = 'address';
        const message = { message: 'message' };
        const headers = { header: 'header' };
        const obs = eb.rxSend(address, message, headers);
        obs.subscribe();
        expect(sendSpy).to.have.been.calledOnce;
        expect(sendSpy).to.have.been.calledWithMatch(address, message, headers);
      });
      describe('when message reply received', () => {
        it('should emit received reply message and complete', async () => {
          const delegate = new FakeDelegate();
          const eb = new EventBus(delegate);
          const expectedMsg: Message = { address: '1234', body: 'expected' };
          sinon
            .stub(delegate, 'send')
            .callsFake((address: any, message: any, headers: any, callback: nodeStyleCallback) => {
              callback(null, expectedMsg);
            });
          const obs = eb.rxSend('test', { test: 'test' });
          const emissions = await getEmissions(obs);
          expect(emissions).to.have.length(2);
          expect(emissions[0]).to.have.property('value', expectedMsg);
          expect(emissions[1]).to.have.property('kind', 'C');
        });
        describe('when reply message has a reply address', () => {
          it('should append reply fns before emitting the message', async () => {
            const delegate = new FakeDelegate();
            const eb = new EventBus(delegate);
            const expectedMsg: Message = { address: '1234', body: 'expected', replyAddress: '4321' };
            sinon
              .stub(delegate, 'send')
              .callsFake((address: any, message: any, headers: any, callback: nodeStyleCallback) => {
                callback(null, expectedMsg);
              });
            const obs = eb.rxSend('test', { test: 'test' });
            const emissions = await getEmissions(obs);
            expect(emissions).to.have.length(2);
            expect(emissions[0]).to.have.property('value');
            expect(emissions[0].value.reply).to.be.a('function');
            expect(emissions[0].value.rxReply).to.be.a('function');
            expect(emissions[1]).to.have.property('kind', 'C');
          });
        });
        describe('when reply message does not have a reply address', () => {
          it('should not  append reply fns', async () => {
            const delegate = new FakeDelegate();
            const eb = new EventBus(delegate);
            const expectedMsg: Message = { address: '1234', body: 'expected' };
            sinon
              .stub(delegate, 'send')
              .callsFake((address: any, message: any, headers: any, callback: nodeStyleCallback) => {
                callback(null, expectedMsg);
              });
            const obs = eb.rxSend('test', { test: 'test' });
            const emissions = await getEmissions(obs);
            expect(emissions).to.have.length(2);
            expect(emissions[0]).to.have.property('value');
            expect(emissions[0].value).to.not.have.property('reply');
            expect(emissions[0].value).to.not.have.property('rxReply');
            expect(emissions[1]).to.have.property('kind', 'C');
          });
        });
      });

      describe('when error reply received', () => {
        it('should error with received error reply', async () => {
          const delegate = new FakeDelegate();
          const eb = new EventBus(delegate);
          const expectedErr = { type: 'err' };
          sinon
            .stub(delegate, 'send')
            .callsFake((address: any, message: any, headers: any, callback: nodeStyleCallback) => {
              callback(expectedErr);
            });
          const obs = eb.rxSend('test', { test: 'test' });
          const emissions = await getEmissions(obs);
          expect(emissions).to.have.length(1);
          expect(emissions[0]).to.have.property('error', expectedErr);
        });
      });
      describe('when error thrown by delegate', () => {
        it('should error with thrown error', async () => {
          const delegate = new FakeDelegate();
          const eb = new EventBus(delegate);
          const expectedErr = new Error('expected');
          sinon
            .stub(delegate, 'send')
            .callsFake((address: any, message: any, headers: any, callback: nodeStyleCallback) => {
              throw expectedErr;
            });
          const obs = eb.rxSend('test', { test: 'test' });
          const emissions = await getEmissions(obs);
          expect(emissions).to.have.length(1);
          expect(emissions[0]).to.have.property('error', expectedErr);
        });
      });

      describe('when connection closes while waiting for a reply', () => {
        describe('when close is clean', () => {
          it('should complete', () => {
            RxMarbleHelper.run(({ cold, expectObservable }) => {
              const delegate = new FakeDelegate();
              const eb = new EventBus(delegate);
              const effects = {
                C: () => delegate.sockJSConn.emit('close', getCloseEvent(true)),
              };
              cold('--C', effects).do(callFn).subscribe();
              expectObservable(eb.rxSend('test', {})).toBe('--|');
            });
          });
        });
        describe('when close is not clean', () => {
          it('should error with close event', () => {
            RxMarbleHelper.run(({ cold, expectObservable }) => {
              const delegate = new FakeDelegate();
              const eb = new EventBus(delegate);
              const closeEvent = getCloseEvent(false);
              const effects = {
                C: () => delegate.sockJSConn.emit('close', closeEvent),
              };
              cold('--C', effects).do(callFn).subscribe();
              expectObservable(eb.rxSend('test', {})).toBe('--#', [], closeEvent);
            });
          });
        });
      });
    });
  });

  describe('publish', () => {
    it('should call delegate.publish with given parameters', () => {
      const delegate = new FakeDelegate();
      const eb = new EventBus(delegate);
      const stub = sinon.stub(delegate, 'publish')
        .callsFake(getNoop());
      const address = 'test-address';
      const message = { test: 'message' };
      eb.publish(address, message);
      expect(stub).to.have.been.calledWithMatch(address, message);
    });
  });

  describe('rxConsumer', () => {
    describe('when not subscribed', () => {
      it('should not register handler', () => {
        const delegate = new FakeDelegate();
        const eb = new EventBus(delegate);
        const spy = sinon.spy(delegate, 'registerHandler');
        const obs = eb.rxConsumer('an-address');
        expect(spy).to.not.have.been.called;
      });
    });
    describe('when subscribed', () => {
      it('should register handler with supplied params', () => {
        const delegate = new FakeDelegate();
        const eb = new EventBus(delegate);
        const spy = sinon.spy(delegate, 'registerHandler');
        const address = 'address';
        const headers = { message: 'message' };
        const obs = eb.rxConsumer(address, headers);
        obs.subscribe();
        expect(spy).to.have.been.calledOnce;
        expect(spy).to.have.been.calledWithMatch(address, headers);
      });
      describe('when messages received', () => {
        it('should emit received messages', async () => {
          const delegate = new FakeDelegate();
          const eb = new EventBus(delegate);
          const expectedMessages: Message[] = [
            { address: 'address', body: 'test' },
            { address: 'address', body: 'test' },
          ];
          sinon
            .stub(delegate, 'registerHandler')
            .callsFake((address: any, headers: any, callback: nodeStyleCallback) => {
              for (const msg of expectedMessages) {
                callback(null, msg);
              }
            });
          const obs = eb.rxConsumer('test').take(expectedMessages.length);
          const emissions = await getEmissions(obs);
          expect(emissions).to.have.length(3);
          expect(emissions[0]).to.have.property('value', expectedMessages[0]);
          expect(emissions[1]).to.have.property('value', expectedMessages[1]);
          expect(emissions[2]).to.have.property('kind', 'C');
        });
        describe('when received message has a reply addresses', () => {
          it('should append reply fns before emitting the message', async () => {
            const delegate = new FakeDelegate();
            const eb = new EventBus(delegate);
            const expectedMsg: Message = { address: '1234', body: 'expected', replyAddress: '4321' };
            sinon
              .stub(delegate, 'registerHandler')
              .callsFake((address: any, headers: any, callback: nodeStyleCallback) => {
                callback(null, expectedMsg);
              });
            const obs = eb.rxConsumer('test', { test: 'test' }).take(1);
            const emissions = await getEmissions(obs);
            expect(emissions).to.have.length(2);
            expect(emissions[0]).to.have.property('value');
            expect(emissions[0].value.reply).to.be.a('function');
            expect(emissions[0].value.rxReply).to.be.a('function');
            expect(emissions[1]).to.have.property('kind', 'C');
          });
        });
        describe('when received message does not have a reply address', () => {
          it('should not  append reply fns', async () => {
            const delegate = new FakeDelegate();
            const eb = new EventBus(delegate);
            const expectedMsg: Message = { address: '1234', body: 'expected' };
            sinon
              .stub(delegate, 'registerHandler')
              .callsFake((address: any, headers: any, callback: nodeStyleCallback) => {
                callback(null, expectedMsg);
              });
            const obs = eb.rxConsumer('test', { test: 'test' }).take(1);
            const emissions = await getEmissions(obs);
            expect(emissions).to.have.length(2);
            expect(emissions[0]).to.have.property('value');
            expect(emissions[0].value).to.not.have.property('reply');
            expect(emissions[0].value).to.not.have.property('rxReply');
            expect(emissions[1]).to.have.property('kind', 'C');
          });
        });
      });

      describe('when error message received', () => {
        it('should error with received message', async () => {
          const delegate = new FakeDelegate();
          const eb = new EventBus(delegate);
          const expectedMsg: Message = { address: 'address', body: {} };
          const expectedErr: Error = { failureCode: 1, failureType: 'type', message: 'test' };
          sinon
            .stub(delegate, 'registerHandler')
            .callsFake((address: any, headers: any, callback: nodeStyleCallback) => {
              callback(null, expectedMsg);
              callback(expectedErr);
            });
          const obs = eb.rxConsumer('test', { test: 'test' });
          const emissions = await getEmissions(obs);
          expect(emissions).to.have.length(2);
          expect(emissions[0]).to.have.property('value', expectedMsg);
          expect(emissions[1]).to.have.property('error', expectedErr);
        });
      });
      describe('when error thrown by delegate', () => {
        it('should error with thrown error', async () => {
          const delegate = new FakeDelegate();
          const eb = new EventBus(delegate);
          const expectedErr = new Error('expected');
          sinon
            .stub(delegate, 'registerHandler')
            .callsFake((address: any, headers: any, callback: nodeStyleCallback) => {
              throw expectedErr;
            });
          const obs = eb.rxConsumer('test', { test: 'test' });
          const emissions = await getEmissions(obs);
          expect(emissions).to.have.length(1);
          expect(emissions[0]).to.have.property('error', expectedErr);
        });
      });

      describe('when connection closes while subscribed', () => {
        describe('when close is clean', () => {
          it('should complete', () => {
            RxMarbleHelper.run(({ cold, expectObservable }) => {
              const delegate = new FakeDelegate();
              const eb = new EventBus(delegate);
              const effects = {
                C: () => delegate.sockJSConn.emit('close', getCloseEvent(true)),
              };
              cold('--C', effects).do(callFn).subscribe();
              expectObservable(eb.rxConsumer('test')).toBe('--|');
            });
          });
        });
        describe('when close is not clean', () => {
          it('should error with close event', () => {
            RxMarbleHelper.run(({ cold, expectObservable }) => {
              const delegate = new FakeDelegate();
              const eb = new EventBus(delegate);
              const closeEvent = getCloseEvent(false);
              const effects = {
                C: () => delegate.sockJSConn.emit('close', closeEvent),
              };
              cold('--C', effects).do(callFn).subscribe();
              expectObservable(eb.rxConsumer('test')).toBe('--#', [], closeEvent);
            });
          });
        });
      });
    });
    describe('when unsubscribed', () => {
      describe('when state is OPEN', () => {
        it('should unregister handler', () => {
          const delegate = new FakeDelegate();
          delegate.state = State.OPEN;
          const eb = new EventBus(delegate);
          const registeredAddress = 'address-test';
          const spy = sinon.spy(delegate, 'unregisterHandler');
          const subs = eb.rxConsumer(registeredAddress).subscribe();
          expect(subs).to.have.property('closed', false);
          subs.unsubscribe();
          expect(spy).to.have.been.calledWithMatch(registeredAddress);
        });
      });
      describe('when state is not OPEN', () => {
        it('should not unregister handler', () => {
          const delegate = new FakeDelegate();
          delegate.state = State.CLOSING;
          const eb = new EventBus(delegate);
          const registeredAddress = 'address-test';
          const spy = sinon.spy(delegate, 'unregisterHandler');
          const subs = eb.rxConsumer(registeredAddress).subscribe();
          expect(subs).to.have.property('closed', false);
          subs.unsubscribe();
          expect(spy).to.not.have.been.called;
        });
      });
    });
  });

  describe('close', () => {
    it('should call delegate.close', () => {
      const delegate = new FakeDelegate();
      const eb = new EventBus(delegate);
      const stub = sinon
        .stub(delegate, 'close')
        .callsFake(getNoop());
      eb.close();
      expect(stub).to.have.been.called;
    });
  });

  describe('setPingEnabled', () => {
    it('should call delegate.pingEnabled with given argument', () => {
      const delegate = new FakeDelegate();
      const eb = new EventBus(delegate);
      const stub = sinon
        .stub(delegate, 'pingEnabled')
        .callsFake(getNoop());
      eb.setPingEnabled(false);
      expect(stub).to.have.been.calledWithExactly(false);
    });
  });

  describe('_appendReplyFns', () => {
    it('should not append when reply address is not present', () => {
      const eb = new EventBus(new FakeDelegate());
      const msg: Message = {
        address: 'test',
      };
      const res = (eb as any)._appendReplyFns(msg);
      expect(res).to.not.haveOwnProperty('reply');
      expect(res).to.not.haveOwnProperty('rxReply');
    });

    it('should append when reply address is present', () => {
      const eb = new EventBus(new FakeDelegate());
      const msg: Message = {
        address: 'test',
        replyAddress: 'rep',
      };
      const res: Message = (eb as any)._appendReplyFns(msg);
      expect(res.reply).to.be.a('function');
      expect(res.rxReply).to.be.a('function');
    });
  });
});

type nodeStyleCallback = (err?: any, res?: any) => void;

class FakeDelegate {
  defaultHeaders: object = {};
  sockJSConn = new EventEmitter();
  state: State = State.CONNECTING;
  onopen: () => void;
  onclose: (err?: any) => void;
  send = getNoop();
  publish = getNoop();
  registerHandler = getNoop();
  unregisterHandler = getNoop();
  close = getNoop();
  pingEnabled = getNoop();
}
