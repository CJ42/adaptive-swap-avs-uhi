import {
  JsonRpcProvider,
  Wallet,
  Contract,
  ethers,
  BigNumberish,
} from "ethers";
import * as dotenv from "dotenv";
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

// @dev The volatility data is mocked here but should be retrieved from an external API
function fetchVolatilityData(): VolatilityData {
  // Start with a base short-term volatility
  const volatilityMinute = +(Math.random() * 1.0).toFixed(2); // 0.00% – 1.00%

  // Simulate growth across timeframes
  const volatilityHour = +(volatilityMinute + Math.random() * 1.5).toFixed(2); // ~1min + [0 – 1.5]
  const volatilityDay = +(volatilityHour + Math.random() * 2.5).toFixed(2); // ~1h + [0 – 2.5]

  // get the UNIX timestamp for Solidity contract
  const lastRetrieved = Date.now();

  return {
    timestamp: lastRetrieved,
    minute: volatilityMinute,
    hour: volatilityHour,
    day: volatilityDay,
  };
}

/// @dev Calculate weighted average volatility based on different time frames.
// The volatility is weighted more heavily toward the short term (1-minute)
// but also takes into account longer time frames to prevent overreaction to price spikes.
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
    const volatilityData = fetchVolatilityData();

    // 2. Calculate the weighted average
    const weightedAverageVolatility =
      calculateWeightedAverageVolatility(volatilityData);

    // 3. Push new row to the table data
    updateLogTable(volatilityData, weightedAverageVolatility);

    // 4. Print the update table
    console.clear();
    console.table(allLogs);

    // 3. Update the VolatilityDataServiceManager

    const latestData = allLogs[allLogs.length - 1];
    console.log(latestData);

    const lastUpdate = new Date(
      latestData.timestamp * 1000
    ).toLocaleTimeString();

    console.log(`📝 Updating latest volatility data (${lastUpdate})`);
    updateVolatilityData({
      timestamp: latestData.timestamp,
      minute: ethers.toBigInt(Math.round(latestData.minute * 100)),
      hour: ethers.toBigInt(Math.round(latestData.hour * 100)),
      day: ethers.toBigInt(Math.round(latestData.day * 100)),
      weightedAverage: ethers.toBigInt(
        Math.round(latestData.weightedAverage * 100)
      ),
    });
  }, UPDATE_INTERVAL);
}
startPushingVolatilityData();
