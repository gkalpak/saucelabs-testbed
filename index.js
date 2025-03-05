// Super constants
// TODO(gkalpak): Add ability to configure these via CLI options.
const browser = ['chromeLatest', 'ie9'][0];
const scVersion = ['5.2.3', '4.9.2'][0];
const isScLt5 = Number(scVersion.split('.', 1)) < 5;

// Imports
const {equal} = require('node:assert/strict');
const {createServer, STATUS_CODES} = require('node:http');
const {createReadStream} = require('node:fs');
const {env, stderr, stdout} = require('node:process');
const {parseArgs} = require('node:util');

const {default: SauceLabs} = require(isScLt5 ? 'saucelabs-8' : 'saucelabs-9');
const {remote} = require('webdriverio');


// Types
/** @import {Server} from 'node:http' */
/** @import {ParseArgsConfig} from 'node:util' */
/** @import {SauceConnectOptions as SauceConnectOptions8} from 'saucelabs-8' */
/** @import {SauceConnectInstance, SauceConnectOptions as SauceConnectOptions9, SauceLabsOptions} from 'saucelabs-9' */
/** @import {RemoteOptions} from 'webdriverio' */


// Constants
const tunnelName = 'test-run';

const localHost = 'localhost';
const localPort = 8080;
const localPublicDir = `${__dirname}/public`;

/** @satisfies {ParseArgsConfig['options']} */
const cliOptions = {
  'demo-local': {
    short: 'l',
    type: 'boolean',
    default: false,
  },
  'demo-remote': {
    short: 'r',
    type: 'boolean',
    default: false,
  },
  'sauce-connect': {
    short: 't',
    type: 'boolean',
    default: false,
  },
  'server': {
    short: 's',
    type: 'boolean',
    'default': false,
  },
};
const capabilities = {
  chromeLatest: {
    browserName: 'chrome',
    browserVersion: 'latest',
    platformName: 'macOS 13',
    'sauce:options': {
      build: 'test-run-0',
      name: 'Test run',
      public: 'team',
      tunnelName,
    },
  },
  ie9: {
    browserName: 'internet explorer',
    version: '9',
    platform: 'Windows 7',
    build: 'test-run-0',
    name: 'Test run',
    public: 'team',
    tunnelName,
  },
};

/** @satisfies {SauceConnectOptions8 & SauceConnectOptions9} */
const baseSauceConnectOptions = {
  logger: getLogger('SauceConnect').info,
  scVersion,
  tunnelName,
};
/** @satisfies {SauceConnectOptions8} */
const sauceConnectOptions8 = {
  verbose: true,
};
/** @satisfies {SauceConnectOptions9} */
const sauceConnectOptions9 = {
  logLevel: 'debug',
  proxyLocalhost: 'direct',
};
const sauceConnectOptions = {
  ...baseSauceConnectOptions,
  ...(isScLt5 ? sauceConnectOptions8 : sauceConnectOptions9),
};

/** @satisfies {SauceLabsOptions} */
const sauceLabsOptions = {
  user: env.SAUCE_USERNAME ?? '',
  key: env.SAUCE_ACCESS_KEY ?? '',
}

/** @satisfies {RemoteOptions} */
const webdriverRemoteOptions = {
  user: sauceLabsOptions.user,
  key: sauceLabsOptions.key,
  logLevel: 'debug',
  capabilities: capabilities[browser],
};

// Run
_main(parseArgs({options: cliOptions}));

// Helpers
/**
 * @param {ReturnType<typeof parseArgs>} param0
 * @return {Promise<void>}
 */
async function _main({values}) {
  if (values['demo-local']) {
    await runSampleLocalTest();
  } else if (values['demo-remote']) {
    await runSampleTest('https://example.com/');
  } else if (values['sauce-connect']) {
    await startSauceConnect();
  } else if (values['server']) {
    await startLocalServer();
  } else {
    throw new Error(
        'Missing CLI option. You must give one of: ' +
        Object.entries(cliOptions).map(([key, val]) => `--${key} (-${val.short})`).join(', '));
  }
}

/**
 * @param {string} label
 * @return {{error: (msg: string) => void, info: (msg: string) => void}}
 */
function getLogger(label) {
  const transformMsg = msg => `${`${msg}`.trim().replace(/^/gm, `[${label}] `)}\n`;

  return {
    error: msg => stderr.write(transformMsg(msg)),
    info: msg => stdout.write(transformMsg(msg)),
  };
}

/**
 * @return {Promise<void>}
 */
async function runSampleLocalTest() {
  let localServer;

  try {
    localServer = await startLocalServer();
    await runSampleTest(`http://${localHost}:${localPort}/`);
  } finally {
    await localServer?.stop();
  }
}

/**
 * @param {string} url
 * @return {Promise<void>)
 */
async function runSampleTest(url) {
  let sauceConnect;
  let browser;

  try {
    // Start SauceConnect.
    sauceConnect = await startSauceConnect();

    // Create WebDriver instance.
    browser = await remote(webdriverRemoteOptions);

    // Run tests.
    await browser.navigateTo(url);
    const heading = await browser.$('h1');

    equal(await heading.getText(), 'Example Domain');
  } finally {
    // Clean up.
    await browser?.deleteSession();
    await sauceConnect?.close();
  }

  console.log('\nDone.');
}

/**
 * @return {Promise<SauceConnectInstance>}
 */
async function startSauceConnect() {
  let sauceConnect;

  try {
    // Start SauceConnect.
    const sauceConnectApi = new SauceLabs(sauceLabsOptions);
    sauceConnect = await sauceConnectApi.startSauceConnect(sauceConnectOptions);

    // NOTE: `SauceLabs` will handle graceful shutdown on exit, so no need to handle manually.

    sauceConnectOptions.logger('\nSauceConnect...ed ;)\n');

    return sauceConnect;
   } catch (err) {
    // Clean up.
    await sauceConnect?.close();

    throw err;
  }
}

/**
 * @return {Promise<Server & {stop: () => Promise<void>}>}
 */
function startLocalServer() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    const logger = getLogger('Local Server');

    server.on('error', err => {
      logger.error(`${err.stack ?? err}`);
      reject(err);
    });

    server.on('listening', () => {
      logger.info(`Server up and running and listening on: http://${localHost}:${localPort}/`);
      resolve(Object.assign(server, {
        stop: () => /** @type {Promise<void>} */(new Promise(resolve => server.close(() => resolve()))),
      }));
    });

    server.on('request', (req, res) => {
      logger.info(`${req.method ?? 'UNKNOWN'} ${req.url ?? ''} (Agent: ${req.headers['user-agent'] ?? 'N/A'})`);

      const url = new URL(`http://${localHost}${req.url}`);
      const originalPathname = url.pathname.replace(/\/$/, '');
      const candidatePathnames = [originalPathname, `${originalPathname}/index.html`];
      let foundFile = false;

      for (const pathname of candidatePathnames) {
        if (foundFile) {
          break;
        }

        switch (pathname) {
          case '/index.html':
            foundFile = true;

            res.writeHead(200, STATUS_CODES['200'], {'Content-Type': 'text/html'});

            const readStream = createReadStream(`${localPublicDir}/${pathname}`);
            readStream.pipe(res);
            readStream.on('end', () => res.end());

            break;
        }
      }

      if (!foundFile) {
        res.writeHead(404, STATUS_CODES['404'], {'Content-Type': 'text/plain'});
        res.end(STATUS_CODES['404']);
      }
    });

    server.listen(localPort, localHost);
  });
}
