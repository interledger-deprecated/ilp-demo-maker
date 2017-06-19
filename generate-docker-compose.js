const path = require('path')
const argv = require('yargs').argv
const fs = require('fs')

if (argv.help) {
  console.log('usage: generate-docker-compose.js --ledgers <json file>\n\n',
    ' --ledgers <json file> : (required) load json file containing ledgers.\n',
    ' --header  <file>      : (optional) start docker compose with contents\n',
    '                         of <file> instead of default docker-compose.\n')
  process.exit(0)
}

if (!argv.ledgers) {
  console.error('must specify --ledgers <json file>')
  process.exit(1)
}

function loadHeaderFile (file) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8')
}

const ledgers = require(path.join(process.cwd(), argv.ledgers))
const header = argv.header ? loadHeaderFile(argv.header) : `
version: "2.1"
networks:
  kit:
services:

  postgres:
    container_name: "postgres"
    build:
      context: "."
      dockerfile: "PostgresDockerfile"
    volumes:
      - "./data/postgres-data:/var/lib/postgresql/data"
    environment:
      PGDATA: "/var/lib/postgresql/data"
      POSTGRES_USER: "admin"
      POSTGRES_PASSWORD: "password"
    networks:
      kit:
        aliases:
          - "postgres"
`

function peerToSide (isLeft, n) {
  return ((n + (isLeft ? 1 : -1)) + ledgers.length ) % ledgers.length
}

function createConfig (n, ledger, isLeft) {
  const config = {
    currency: ledger.currency,
    plugin: ledger.plugin,
    store: ledger.store,
    options: Object.assign({},
      ledger.optionsCommon,
      isLeft
        ? ledger.optionsLeft
        : ledger.optionsRight)
  }

  const pn = peerToSide(isLeft, n)
  const otherAccount = isLeft ? ledger.right_account : ledger.left_account
  if (ledger.rpcUri) {
    config.options.rpcUri = `http://ilp-kit${pn}:${pn + 2}010/api/peers/rpc`
    console.error(n, config.options.rpcUri)
  } else if (ledger.rpcUris) {
    const account = otherAccount
    config.options.rpcUris = {
      [account]: `http://ilp-kit${pn}:${pn + 2}010/api/peers/rpc`
    }
    console.error(n, config.options.rpcUris)
  }

  return config
}

function generateConnectorLedgers (i) {
  const next = (i + 1) % ledgers.length
  const connectorLedgers = {
    [`test.dev.kit${i}.`]: {
      currency: 'USD',
      plugin: 'ilp-plugin-bells',
      options: {
        account: `http://ilp-kit${i}:${i + 2}010/ledger/accounts/connector`,
        password: 'password',
        username: 'connector'
      }
    },
    [ledgers[i].name]: createConfig(i, ledgers[i], false),
    [ledgers[next].name]: createConfig(i, ledgers[next], true)
  }

  console.error(i, Object.keys(connectorLedgers))
  return JSON.stringify(connectorLedgers)
}

function generateConnectorRoutes (i) {
  const next = (i + 1) % ledgers.length
  const ledger = ledgers[next]
  const connectorRoutes = [ {
    targetPrefix: '',
    connectorLedger: ledger.name,
    connectorAccount: ledger.right_account
  } ]

  console.error(i, connectorRoutes)
  return JSON.stringify(connectorRoutes)
}

let file = ''
file += header
for (let i = 0; i < ledgers.length; ++i) {
  file += `
  ilp-kit${i}:
    container_name: "ilp-kit${i}"
    build:
      context: "."
      dockerfile: "IlpKitDockerfile"
    command: >
      /bin/bash -c "
        while ! nc -z postgres 5432; do sleep 5; done;
        npm start
      "
    volumes:
      - "./data/uploads${i}:/usr/src/app/uploads"
    networks:
      kit:
        aliases:
          - "ilp-kit${i}"
    ports:
      - "${i + 2}010:${i + 2}010"
    environment:
      DB_URI: "postgres://admin:password@postgres/ilp-kit${i}"
      API_HOSTNAME: "ilp-kit${i}"
      API_PORT: "${i + 2}100"
      API_PRIVATE_HOSTNAME: "ilp-kit${i}"
      API_PUBLIC_HTTPS: "false"
      API_PUBLIC_PATH: "/api"
      API_PUBLIC_PORT: "${i + 2}010"
      API_SECRET: "password"
      CLIENT_HOST: "ilp-kit"
      CLIENT_PORT: "${i + 2}010"
      CLIENT_PUBLIC_PORT: "${i + 2}010"
      CLIENT_TITLE: "ILP Kit ${i}"
      LEDGER_ADMIN_NAME: "admin"
      LEDGER_ADMIN_PASS: "password"
      LEDGER_CURRENCY_CODE: "USD"
      LEDGER_ILP_PREFIX: "test.dev.kit${i}."
      LEDGER_RECOMMENDED_CONNECTORS: "connector"
      CONNECTOR_ENABLE: "true"
      CONNECTOR_LEDGERS: '${generateConnectorLedgers(i)}'
      CONNECTOR_ROUTES: '${generateConnectorRoutes(i)}'
      CONNECTOR_ROUTE_BROADCAST_ENABLED: "false"
      CONNECTOR_BACKEND: "fixerio-plus-coinmarketcap"
      CONNECTOR_MAX_HOLD_TIME: "2000"
      API_REGISTRATION: "true"
      LEDGER_AMOUNT_SCALE: "9"
      LEDGER_AMOUNT_PRECISION: "19"
      ILP_KIT_CLI_VERSION: "11.0.1"
      DEBUG: "connector*,ilp*"
`
}

console.log(file)
