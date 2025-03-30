import {
  JsonRpcProvider,
  Wallet,
  Contract,
  ethers,
  BigNumberish,
} from "ethers";
import * as dotenv from "dotenv";
import { getRandomNumberInRange } from "./utils";

const fs = require("fs");
const path = require("path");
dotenv.config();

// Setup env variables
const provider = new JsonRpcProvider(process.env.RPC_URL);
const wallet = new Wallet(process.env.PRIVATE_KEY!, provider);

/// TODO: this is a hack to connect to anvil
const chainId = 31337;

const avsDeploymentData = JSON.parse(
  fs.readFileSync(
    path.resolve(
      __dirname,
      `../contracts/deployments/volatility-data/${chainId}.json`
    ),
    "utf8"
  )
);
const volatilityDataServiceManagerAddress =
  avsDeploymentData.addresses.volatilityDataServiceManager;
const volatilityDataServiceManagerABI = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../abis/VolatilityDataServiceManager.json"),
    "utf8"
  )
);
// Initialize contract objects from ABIs
const volatilityDataServiceManager = new Contract(
  volatilityDataServiceManagerAddress,
  volatilityDataServiceManagerABI,
  wallet
);

// in milliseconds
// const UPDATE_INTERVAL = 300000; // 5min
const UPDATE_INTERVAL = 10000; // every 10 seconds

type VolatilityData = {
  timestamp: number;
  minute: number;
  hour: number;
  day: number;
};

type VolatilityDataToConvert = {
  minute: number; // in bps
  hour: number;
  day: number;
  weightedAverage: number;
};

// @dev The volatility data should be retrieved from an external API, but is mocked here.
// It is mocked to represent volatility data as realistic as possible using ETH price volatility data from coinmarketcap.com (toggle Tradingview)
// https://coinmarketcap.com/currencies/ethereum/
//
// |-----------|----------------------|-------------------------|
// | Timeframe |	Typical Range (ETH) |	Comment                 |
// |-----------|----------------------|-------------------------|
// | 1 min     |	0.01% – 0.3%        |	Short-term spikes/noise |
// | 1 hour    |	0.3% – 1.5%         |	Active hour             |
// | 1 day     |	1.5% – 6.5%         |	Trend or dump           |
// |-----------|----------------------|-------------------------|
function generateMockVolatilityData(): VolatilityData {
  // get the UNIX timestamp for Solidity contract
  const lastRetrieved = Date.now();

  return {
    timestamp: lastRetrieved,
    minute: getRandomNumberInRange(0.01, 0.3), // 1m volatility: 0.01% – 0.3%
    hour: getRandomNumberInRange(0.3, 1.5), // 1h volatility: 0.3% – 1.5%
    day: getRandomNumberInRange(1.5, 6.5), // 1d volatility: 1.5% – 5.5%
  };
}

function convertVolatilityToBps(dataInPercentage: VolatilityDataToConvert) {
  return {
    minute: ethers.toBigInt(Math.round(dataInPercentage.minute * 100)),
    hour: ethers.toBigInt(Math.round(dataInPercentage.hour * 100)),
    day: ethers.toBigInt(Math.round(dataInPercentage.day * 100)),
    weightedAverage: ethers.toBigInt(
      Math.round(dataInPercentage.weightedAverage * 100)
    ),
  };
}

/// @dev Calculate weighted average volatility based on different time frames.
// The volatility is weighted more heavily toward the 1-minute time range (counted as 50%)
// but also takes into account hour and day volatility to prevent overreaction to price spikes.
function calculateWeightedAverageVolatility(volatilityData: VolatilityData) {
  // volatility per minute counts for 50%
  const weightedVolatilityForMinute = volatilityData.minute * 0.5;

  // volatility per hour counts for 30%
  const weightedVolatilityForHour = volatilityData.hour * 0.3;

  // volatility per day counts for 20%
  const weightedVolatilityForDay = volatilityData.day * 0.2;

  const weightedAverage =
    weightedVolatilityForMinute +
    weightedVolatilityForHour +
    weightedVolatilityForDay;

  return +weightedAverage.toFixed(2);
}

async function updateVolatilityData(volatilityData: {
  timestamp: number;
  minute: BigNumberish;
  hour: BigNumberish;
  day: BigNumberish;
  weightedAverage: BigNumberish;
}) {
  try {
    await volatilityDataServiceManager.submitNewVolatilityData(volatilityData);
  } catch (error) {
    console.error(
      "Error sending transaction to udpate volatility data:",
      error
    );
  }
}

const allLogs: {
  timestamp: number;
  minute: number;
  hour: number;
  day: number;
  weightedAverage: number;
}[] = [];

function updateLogTable(
  volatilityData: VolatilityData,
  weightedAverage: number
) {
  // 3. Push new row to the table data
  allLogs.push({
    timestamp: volatilityData.timestamp,
    minute: volatilityData.minute,
    hour: volatilityData.hour,
    day: volatilityData.day,
    weightedAverage: weightedAverage,
  });
}

function startPushingVolatilityData() {
  setInterval(() => {
    // 1. Fetch the latest volatility data
    const volatilityData = generateMockVolatilityData();

    // 2. Calculate the weighted average
    const weightedAverageVolatility =
      calculateWeightedAverageVolatility(volatilityData);

    // 3. Push new row to the table data
    updateLogTable(volatilityData, weightedAverageVolatility);

    // 4. Print the update table
    console.clear();
    console.table(allLogs);

    const latestData = allLogs[allLogs.length - 1];
    const lastUpdate = new Date(latestData.timestamp).toString();

    // Convert the volatility data to bps to set it inside the smart contract
    const volatilityDataBps = convertVolatilityToBps({
      minute: volatilityData.minute,
      hour: volatilityData.hour,
      day: volatilityData.day,
      weightedAverage: weightedAverageVolatility,
    });

    const stateDataToSubmit = {
      timestamp: latestData.timestamp,
      ...volatilityDataBps,
    };

    // 3. Update the VolatilityDataServiceManager
    console.log(
      `📝 Updating latest volatility data (${lastUpdate}) on VolatilityDataServiceManager contract with following data: `,
      stateDataToSubmit
    );
    updateVolatilityData(stateDataToSubmit);
  }, UPDATE_INTERVAL);
}
startPushingVolatilityData();
