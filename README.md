# logs-service 

Exposes log files form each node module (service).
The service provides basic API to support log aggregation by an outside system.

## Accessing logs

Access the service using the http port (or other url prefix) indicated in node/management.json (see [http://github.com/orbs-network/management-service/]
 for details). 
 For example, in case the node routes requests to the service at port 8666:
 http://node_ip:8666/
 
 Supported endpoints:
### GET /logs/:service
Where `:service` may be any supported node service (e.g. management-service, ethereum-writer, chain-\<vcid\>).
returns a json file listing the available logs batches for the requested service. for example:
 ```

[
  {
    "fileName": "current",
    "batchSize": 623401,
    "id": 5
  },
  {
    "fileName": "@400000005f796b361764ea1c.u",
    "cleanFilename": "400000005f796b361764ea1c",
    "batchSize": 3752722,
    "id": 4
  },
  ...
]
 ```
Each entry is designated by an id number. only the top numbered batch may grow in size. previously sealed batches are immutable.
This endpoint is intended mostly for sync automation and for accessing previous batches.

### GET /logs/:service/tail
Opens an active stream of logs from the requested service. The stream will not close unless inactivity timeout is enforced by a network component along the way, or if the client closes the connection. 

### GET /logs/:service/batch/:id
Get a single batch of logs. Available batch ids may be found by `GET /logs/:service` (see above)

Batch query options (may be combined):
#### GET /logs/:service/batch/:id?follow
Applicable only for the latest available batch. Gets the existing log bytes in the batch, and keeps the connection open for newly appended lines. Once the batch is sealed, the connection is closed by the server. This connection may also be closed prematurely so any automation client must verify that there is a newer batch after the connection closes.

When called for a batch which is already sealed, `follow` has no effect

#### GET /logs/:service/batch/:id?start=n
Where `n` is the (one based) offset in the requested batch to start transmission of bytes from. Typically, if a client previously downloaded `N` bytes from the same batch, a request with `start=N+1` will result in the response starting from the next availeble byte.


If `n` is larger than `batchSize` the response will be empty. 


## Install dev environment

* Make sure [Node.js](https://nodejs.org/) is installed (min 12.14.0).

  * Install with `brew install node`, check version with `node -v`.

* [VSCode](https://code.visualstudio.com/) is recommended as IDE.

  * Recommended extensions [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint), [Prettier - code Formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode).

* [Docker](https://www.docker.com/) is required for running E2E tests.

  * Install [here](https://docs.docker.com/install/), check version with `docker -v`.

* Run in terminal in root project directory:

  ```
  npm install
  npm test
  ```

## Build

* Run in terminal in root project directory:

  ```
  npm run build
  ```

  > Note that the Python errors `gyp ERR! find Python` on `keccak node-gyp rebuild` are ok.

* Built code will be inside `./dist`.

  * Run it with `npm start`.

* Docker image will be built and tagged as `local/logs-service`.

  * Run it with `docker run local/logs-service`.

## Test

* For unit tests, run in terminal in root project directory:

  ```
  npm run test
  ```

  To run a single test:

  ```
  npm run test:quick -- src/config.test.ts
  ```

* For E2E tests (on docker), run in terminal in root project directory:

  ```
  npm run build
  npm run test:e2e
  ```

  * Note: running E2E locally may leave docker residues:

    * See which instances are running with `docker ps`, stop all with `docker stop $(docker ps -a -q)`

    * See which images exist with `docker images`, delete all relevant with `docker rmi $(docker images --format '{{.Repository}}:{{.Tag}}' | grep 'cicontainer')`
