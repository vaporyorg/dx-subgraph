/* global artifacts, contract, it */
/* eslint no-undef: "error" */
const { assert } = require('chai');
const axios = require('axios');
const delay = require('delay');
const { add } = require('bn.js');

const { eventWatcher, log: utilsLog, assertRejects, timestamp, gasLogger } = require('./utils');
const { getContracts, setupTest, getClearingTime, getAuctionIndex } = require('./testFunctions');
const { randomHex, soliditySha3, toHex, toBN, padLeft, keccak256, toWei, fromWei } = web3.utils;
const TokenGNO = artifacts.require('TokenGNO');
const DutchExchangeProxy = artifacts.require('DutchExchangeProxy');

// Test VARS
let eth;
let gno, gno2;
let mgn;
let dx;
let oracle;

let feeRatio;

let contracts, symbols;

const separateLogs = () => utilsLog('\n    ----------------------------------');
const log = (...args) => utilsLog('\t', ...args);

async function waitForGraphSync(targetBlockNumber) {
  if (targetBlockNumber == null) {
    targetBlockNumber = await web3.eth.getBlockNumber();
  }
  do {
    await delay(100);
  } while (
    (await axios.post('http://127.0.0.1:8000/subgraphs', {
      query: `{subgraphs(orderBy:createdAt orderDirection:desc where: {name: "Gnosis/DutchX"}) { versions { deployment { latestEthereumBlockNumber }} } }`
    })).data.data.subgraphs[0].versions[0].deployment.latestEthereumBlockNumber < targetBlockNumber
  );
}

contract('DutchExchange', accounts => {
  const [master, seller1, buyer1] = accounts;

  const startBal = {
    startingETH: toBN(toWei('90')),
    startingGNO: toBN(toWei('90')),
    ethUSDPrice: toBN(toWei('1008')),
    sellingAmount: toBN(toWei('50'))
  };

  before(async () => {
    // get contracts
    contracts = await getContracts();
    // destructure contracts into upper state
    ({
      EtherToken: eth,
      TokenGNO: gno,
      TokenFRT: mgn,
      DutchExchange: dx,
      PriceOracleInterface: oracle
    } = contracts);

    await setupTest(accounts, contracts, startBal);

    // const totalMgn = (await mgn.totalSupply.call()).toNumber();
    // assert.strictEqual(totalMgn, 0, 'total MGN tokens should be 0');
    // then we know that feeRatio = 1 / 200
    feeRatio = 1 / 200;

    addTokenPairDefaults = {
      token1: eth.address,
      token2: gno.address,
      token1Funding: toBN(toWei('10000')),
      token2Funding: 1000,
      initialClosingPriceNum: 2,
      initialClosingPriceDen: 1
    };

    // a new deployed GNO to act as a different token
    gno2 = await TokenGNO.new(toBN(toWei('1000')), { from: master });

    await Promise.all([
      gno2.transfer(seller1, startBal.startingGNO, { from: master }),
      gno2.approve(dx.address, startBal.startingGNO, { from: seller1 })
    ]);
    await dx.deposit(gno2.address, startBal.startingGNO, { from: seller1 });

    symbols = {
      [eth.address]: 'ETH',
      [gno.address]: 'GNO',
      [gno2.address]: 'GNO2'
    };
  });

  it('DutchExchange', async () => {
    // Add a token pair
    let threshhold = await dx.thresholdNewTokenPair();
    threshhold = fromWei(threshhold.toString());
    console.log(threshhold);
    await addTokenPair(seller1);
    await waitForGraphSync();

    let results = (await axios.post('http://127.0.0.1:8000/subgraphs/name/Gnosis/DutchX', {
      query: '{tokens { id } tokenPairs { id }}'
    })).data.data;
    log(results);
  });
});

// Helper functions
const addTokenPair = (account, options) => {
  options = { ...addTokenPairDefaults, ...options };
  options.token1 = options.token1.address || options.token1;
  options.token2 = options.token2.address || options.token2;

  const {
    token1,
    token2,
    token1Funding,
    token2Funding,
    initialClosingPriceNum,
    initialClosingPriceDen
  } = options;

  log(`tx params:
${JSON.stringify(options, null, 8)}
  `);

  return dx.addTokenPair(
    token1.address || token1,
    token2.address || token2,
    token1Funding,
    token2Funding,
    initialClosingPriceNum,
    initialClosingPriceDen,
    { from: account }
  );
};
