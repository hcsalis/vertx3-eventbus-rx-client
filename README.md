[![Build Status](https://travis-ci.org/hcsalis/vertx3-eventbus-rx-client.svg?branch=master)](https://travis-ci.org/hcsalis/vertx3-eventbus-rx-client)
[![Coverage Status](https://coveralls.io/repos/github/hcsalis/vertx3-eventbus-rx-client/badge.svg?branch=master)](https://coveralls.io/github/hcsalis/vertx3-eventbus-rx-client?branch=master)
[![npm version](https://badge.fury.io/js/vertx3-eventbus-rx-client.svg)](https://badge.fury.io/js/vertx3-eventbus-rx-client)
[![MIT license](http://img.shields.io/badge/license-MIT-brightgreen.svg)](http://opensource.org/licenses/MIT)

# vertx3-eventbus-rx-client

[RxJS](http://reactivex.io/rxjs/) powered Event Bus client for [Vert.x 3](http://vertx.io/).

## Getting Started

### Installation

install using npm:
```
npm install vertx3-eventbus-rx-client --save
```

### Peer Dependencies

Make sure you have RxJS 5 and official event bus client as dependencies in your project, or install them as follows:
```
npm install vertx3-eventbus-client --save
```
```
npm install rxjs --save
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

// getting current state
ebState = eb.state;

// getting current state and future changes
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
ebState = eb.send('address', message);

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
    // received messages
  }
);

// un-register consumer
subscription();
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
