[![Build Status](https://travis-ci.org/hcsalis/vertx3-eventbus-rx-client.svg?branch=master)](https://travis-ci.org/hcsalis/vertx3-eventbus-rx-client)
[![Coverage Status](https://coveralls.io/repos/github/hcsalis/vertx3-eventbus-rx-client/badge.svg?branch=master)](https://coveralls.io/github/hcsalis/vertx3-eventbus-rx-client?branch=master)
[![npm version](https://badge.fury.io/js/vertx3-eventbus-rx-client.svg)](https://badge.fury.io/js/vertx3-eventbus-rx-client)
[![MIT license](http://img.shields.io/badge/license-MIT-brightgreen.svg)](http://opensource.org/licenses/MIT)

# vertx3-eventbus-rx-client

[RxJS](http://reactivex.io/rxjs/) powered Event Bus client for [Vert.x 3](http://vertx.io/).

This library: 
- Offers an API similar to Rxified server counterpart.
- Includes Typescript definitions and provides interfaces for data models (Message, CloseEvent etc.).
- Wraps the official client without side effects, thus can be used together with the official client by providing it as a delegate to the constructor.
- Helps to prevent memory leaks by unsubscribing on disconnect or close (or after receiving a reply in case of rxSend).
- Does not provide features like send with timeout, auto-resubscription etc. because these are trivial to implement with rxjs operators and subjects.

## Getting Started

### Installation

install using npm:
```
npm install vertx3-eventbus-rx-client --save
```

### Peer Dependencies

Make sure you have RxJS (5 or greater) and official event bus client (version 3.4 or greater) as dependencies in your project, or install them as follows:
```
npm install vertx3-eventbus-client --save
```
```
npm install rxjs --save
```

In order to use RxJS 6.x you should install the compatibility layer (see [Backwards compatibility](https://github.com/ReactiveX/rxjs/blob/master/MIGRATION.md#backwards-compatibility)):
```
npm install rxjs-compat --save
```

### Usage

import as ES module:
```javascript
import { EventBus } from 'vertx3-eventbus-rx-client';

const eb = EventBus.create('server-address');
```

import as CommonJS module:
```javascript
const RxEB = require('vertx3-eventbus-rx-client');

const eb = RxEB.EventBus.create('server-address');
```

## API
Creating an instance:
```javascript
// by using factory method
const eb = EventBus.create('server-url');

// by wrapping an existing non-Rxified eventbus object
const eb = new EventBus(delegateEB);
```

EventBus state:
```javascript
let ebState;

// get current state
ebState = eb.state;

// get current state and future changes
eb.state$.subscribe(
  state => {
    ebState = state;
  }
);
```

Sending messages:
```javascript
const message = {};
// send a message
eb.send('address', message);

// send and expect a reply
eb.rxSend('address', message).subscribe(
  reply => {
    // received a reply
  },
  error => {
    // received an error
  }
);
```

Message consumer:
```javascript

// register consumer
const subscription =  eb.rxConsumer('address').subscribe(
  message => {
    // received a message
  }
);

// un-register consumer
subscription.unsubscribe();
```

Getting close event:
```javascript

// get close event
eb.closeEvent;

// close event is null until State is CLOSED 
eb.state$.subscribe(
  state => {
    if (state !== State.CLOSED) {
      console.log(eb.closeEvent); // null
    } else {
      console.log(eb.closeEvent); // NOT null. Refer to CloseEvent docs on the link below.
    }
  }
);
```

Full API documentation can be found [HERE](https://hcsalis.github.io/vertx3-eventbus-rx-client/classes/eventbus.html).

## Testing

Run unit tests with:
```
npm run test
```
End-to-end tests should be run against the [Test Server](https://github.com/hcsalis/vertx3-eventbus-rx-client-test-server). Once it is up and running, start the tests with this command:
```
npm run e2e
```
## License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/hcsalis/vertx3-eventbus-rx-client/blob/master/LICENSE) file for details
