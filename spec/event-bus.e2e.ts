import { expect, use } from 'chai';
import * as Rx from 'rxjs/Rx';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { EventBus } from '../src';
import { State } from '../src/model/state';
import { getEmissions, notifyOnState } from './helpers/util';

const Observable = Rx.Observable;

use(sinonChai);

describe('EventBus', () => {
  const serverUrl = 'http://localhost:9870/eventbus';
  const wrongUrl = 'http://localhost:9870/hopelly-a-wrong-url';
  const publisherAddress = 'publisher';
  const echoAddress = 'echo';
  const failAddress = 'fail';
  const pingPongAddress = 'ping-pong';

  it('should connect to server', async () => {
    const eb = EventBus.create(serverUrl);
    const obs = eb.state$.takeWhile(state => state !== State.OPEN);
    const emissions = await getEmissions(obs);
    expect(emissions).to.have.length(2);
    expect(emissions[0]).to.have.property('value', State.CONNECTING);
    expect(emissions[1]).to.have.property('kind', 'C');
    eb.close();
  });
  describe('when connection fails', () => {
    it('should complete state$', async () => {
      const eb = EventBus.create(wrongUrl);
      const emissions = await getEmissions(eb.state$);
      expect(emissions).to.have.length(3);
      expect(emissions[0]).to.have.property('value', State.CONNECTING);
      expect(emissions[1]).to.have.property('value', State.CLOSED);
      expect(emissions[2]).to.have.property('kind', 'C');
      eb.close();
    });
    it('should have close reason', async () => {
      const eb = EventBus.create(wrongUrl);
      await notifyOnState(eb.state$, State.CLOSED);
      expect(eb.closeEvent).to.be.not.null;
      expect(eb.closeEvent).to.be.not.undefined;
      expect(eb.closeEvent).to.have.property('wasClean', false);
      eb.close();
    });
  });

  it('should send message', async () => {
    const eb = EventBus.create(serverUrl);
    await notifyOnState(eb.state$, State.OPEN);
    eb.send(echoAddress, {});
    eb.close();
  });

  it('should publish message', async () => {
    const eb = EventBus.create(serverUrl);
    await notifyOnState(eb.state$, State.OPEN);
    eb.publish('publisher', {});
    eb.close();
  });

  it('should send message and receive reply', async () => {
    const eb = EventBus.create(serverUrl);
    await notifyOnState(eb.state$, State.OPEN);
    const body = { payload: 'payload' };
    const obs = eb.rxSend(echoAddress, body);
    const emissions = await getEmissions(obs);
    expect(emissions).to.have.length(2);
    expect(emissions[0].value.body).to.be.deep.equal(body);
    eb.close();
  });

  it('should send message and receive failure', async () => {
    const eb = EventBus.create(serverUrl);
    await notifyOnState(eb.state$, State.OPEN);
    const body = {
      failureCode: 500,
      message: 'expected failure',
    };
    const obs = eb.rxSend(failAddress, body, { dummyHeader: 'dummyHeader' });
    const emissions = await getEmissions(obs);
    expect(emissions).to.have.length(1);
    expect(emissions[0]).to.have.property('kind', 'E');
    expect(emissions[0].error).to.have.property('failureCode', body.failureCode);
    expect(emissions[0].error).to.have.property('message', body.message);
    eb.close();
  });

  it('should listen published messages', async () => {
    const eb = EventBus.create(serverUrl);
    await notifyOnState(eb.state$, State.OPEN);
    const obs = eb.rxConsumer(publisherAddress).take(3);
    const emissions = await getEmissions(obs);
    expect(emissions).to.have.length(4);
  });

  it('should reply to message (ping-pong)', async () => {
    const eb = EventBus.create(serverUrl);
    await notifyOnState(eb.state$, State.OPEN);
    const replyOne = await eb.rxSend(pingPongAddress, 'ping').toPromise();
    expect(replyOne).to.have.property('body', 'pong');
    expect(replyOne.reply).to.be.a('function');
    expect(replyOne.rxReply).to.be.a('function');
    if (!replyOne.rxReply) {
      return; // for tsc
    }
    const replyTwo = await replyOne.rxReply('ping').toPromise();
    expect(replyTwo).to.have.property('body', 'pong');
    expect(replyTwo.reply).to.be.a('function');
    expect(replyTwo.rxReply).to.be.a('function');
    if (!replyTwo.reply) {
      return; // for tsc
    }
    await replyTwo.reply({});
  });
});
