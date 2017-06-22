# ILP Demo Maker
> Set up a payment between many different ILP Kit nodes

The ILP Demo Maker constructs a network of ILP Kit nodes for
the purpose of running a demo. Each of the ILP Kits exposes a user interface,
and routing is preconfigured by the script.

![Example network created by this script](https://interledgerjs.github.io/ilp-demo-maker/res/net.svg)

The network created is a ring, allowing any ILP Kit to pay to any other ILP
kit. The payments go in one direction around the ring. The final ledger goes
from the last ILP Kit back to the first one.

## Purpose

Because it can be cumbersome to set up many ILP Kits by hand, the tool uses a
JSON file to generate a Docker Compose file, containing all the ILP kits used
to set up the required plugins.

## Launching the Demo

### Prerequisites

- Docker >=17.0.0
- Docker Compose >=1.14.0
- Node.js >= 6.something

### Setup

Clone the repo and clone each of the plugins you want to use into the `ilp-demo-maker` directory.
They need to be acccessible for Docker to mount them as volumes.

```sh
$ git clone https://github.com/interledgerjs/ilp-demo-maker.git
$ cd ilp-demo-maker
$ npm install
$ git clone https://github.com/{YOUR_PLUGIN}
$ cd YOUR_PLUGIN && npm install && cd ..
```

### Running

Generate a Docker Compose file from the [ledgers configuration file](#configuration-format) and run it.

```
$ node generate-docker-compose.js --ledgers example.json > docker-compose.yml
$ docker-compose build
$ docker-compose up -d
$ docker-compose logs -f
```

This will create a local directory called `data`, containing all the state
of the ILP Kits. If you add, remove, or rearrange any of the ledgers, make
sure that you delete the `data` folder.

To send some test payments, log into one of your ILP kits with `admin:password`.
You'll need to have the source and destination ILP Kit in your hosts file to do
this. Add an entry for each of your ILP kits in your `/etc/hosts` file, like so:

```
127.0.0.1 ilp-kit0
127.0.0.1 ilp-kit1
127.0.0.1 ilp-kit2
127.0.0.1 ilp-kit3
```

To send from Kit 0 to Kit 3, log into `ilp-kit0:2010` as `admin`. Send a payment
to `admin@ilp-kit3:5010` in the sending UI.


## Configuration Format

The JSON file used for the ILP Demo maker contains an array of objects in the
below format. See [`example.json`](./example.json) for a sample config file.

```js
[
  {
    "prefix": "example.ledgerA.", // (1)
    "currency": "USD", // (2)
    "plugin": "ilp-plugin-A", // (3)
    "store": true, // [optional] (4)
    "rpcUri": true, // [optional] (5)
    "rpcUris": true, // [optional] (6)
    "left_account": "example.ledgerA.alice", // (7)
    "left_config": { // (8)
      /* fields required by ilp-plugin-A for account alice */
    },
    "right_account": "example.ledgerA.bob",
    "right_config": {
      /* fields required by ilp-pluginA for account bob */
    }
  }, {
    // next plugin setup
  }
]
```

1. `prefix`: The prefix field contains the ILP prefix for this ledger. This prefix must match the value returned by `plugin.getInfo().prefix` for this plugin. If it does not, routing errors will occur, causing all payments to fail.

2. `currency`: The currency code of this ledger. Used by the connector to determine exchange rates.

3. `plugin`: The plugin module for this ledger. Must be a folder in the current directory. The plugin will then be mounted in the ILP Kit's node_modules.

4. `store`: Set to `true` or `false` (can also be omitted). If this value is `true`, a store will be passed into the plugin constructor, as per the [Ledger Plugin Interface](https://github.com/interledger/rfcs/blob/master/0004-ledger-plugin-interface/0004-ledger-plugin-interface.md#_store).

5. `rpcUri`: Set to `true` or `false` (can also be ommitted). If this value is `true`, an RPC Uri will be passed into the plugin constructor. This URI will point to the peer's RPC endpoint. This will be the correct value for any bilateral plugin (like `ilp-plugin-virtual` or `ilp-plugin-xrp-paychan`).

6. `rpcUris`: Set to `true` or `false` (can also be omitted). If this value is `true`, an object called `rpcUris` will be passed into the plugin constructor. It will have one key, set to the peer's account, and the value will be that peer's RPC Uri. Used for plugins like `ilp-plugin-xrp-escrow` that fall back on RPC for messaging.

![Left vs. Right](https://interledgerjs.github.io/ilp-demo-maker/res/left.svg)

7. `left_account`: The ILP address of the plugin on the left of the ledger. This must match `plugin.getAccount()` for the plugin, or payments will fail. In the above example, the left account is Kit 0's. Due to the routing configuration, payments always go from
the left account to the right account. `right_account` functions the same, but for the plugin on the right.

8. `left_config`: The plugin configuration for the plugin on the left of the ledger. This object is passed directly to the plugin constructor. If `store`, `rpcUri`, or `rpcUris` are set, their fields will be added to this object. `right_config` functions the same, but for the plugin on the right.

### Custom Header File

If you need any additional containers in the docker-compose (eg. a bitcoin
node, an extra five-bells-ledger, etc.), you can set an alternate header file.
This will replace the start of the docker-compose (before the ILP Kit
containers are added) with a file of your choice.

```sh
$ node generate-docker-compose.js --ledger example.json --header header.yml > docker-compose.yml
$ docker-compose build
$ docker-compose up -d
$ docker-compose logs -f
```
