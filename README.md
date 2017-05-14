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

Make sure you have RxJS 5 and original event bus client as dependencies in your project, or install them as follows:
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

Generated API documentation can be found [here](http://hcsalis.github.io/vertx3-eventbus-rx-client).

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

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details
