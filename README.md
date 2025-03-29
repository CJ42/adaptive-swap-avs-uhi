# Adaptive Swap AVS

> Based on the [Eigenlayer Hello World AVS Template](https://github.com/Layr-Labs/hello-world-avs)

Welcome to the Adaptive Swap AVS!

## Architecture

<!-- TODO: create basic diagram here -->

### Adaptive Swap AVS User Flow

1. The Volatility Data AVS regularly push volatility data to the Volatility Data contract

<!-- TODO: only operators registered with the AVS that have staked + delegated assets should be allowed to push data -->

<!-- TODO 2: Operator generates the requested message, hashes it, and signs the hash with their private key. -->

<!-- TODO 3: each operator submits their signed hash back to the Volatility Data AVS contract. If the Operator is registered to the AVS and has the minimum needed stake, the submission is accepted. -->

1. The Hook contract (which is the AVS consumer) consume the latest volatility data submitted during the swap.

# Local Devnet Deployment

The instructions below explain how to manually deploy the AVS from scratch including EigenLayer and AVS specific contracts using Foundry (forge) to a local anvil chain, and start Typescript Operator application and tasks.

## Development Environment

This section describes the tooling required for local development.

Install dependencies:

- [Node](https://nodejs.org/en/download/)
- [Typescript](https://www.typescriptlang.org/download)
- [ts-node](https://www.npmjs.com/package/ts-node)
- [tcs](https://www.npmjs.com/package/tcs#installation)
- [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- [Foundry](https://getfoundry.sh/)
- [ethers](https://www.npmjs.com/package/ethers)

## Quick start

### Step 1 - Start Anvil Chain

In terminal window #1, execute the following commands:

```sh
# Install npm packages
npm install

# Start local anvil chain
npm run start:anvil
```

### Deploy Contracts and Start Operator

Open a separate terminal window #2, execute the following commands

```sh
# Setup .env file
cp .env.example .env
cp contracts/.env.example contracts/.env

# Updates dependencies if necessary and builds the contracts
npm run build:forge

# Deploy the EigenLayer contracts
npm run deploy:core

# Deploy the Volatility Data AVS contract
npm run deploy:volatility-data-avs

# (Optional) Update ABIs
npm run extract:abis
```

<!-- TODO: define if this step is still needed
# Start the Operator application
npm run start:operator
 -->

### Run the Data Feed

After deploying the `VolatiliyDataServiceManager` contract, in the same terminal window, execute the following command to push regularly volatility data to be consumed by the smart contract.

```sh
# Start the createNewTasks application
npm run start:data-feed
```

### Debugging

For help and support deploying and modifying this repo for your AVS, please:

1. Open a ticket via the intercom link at [support.eigenlayer.xyz](https://support.eigenlayer.xyz).
2. Include the necessary troubleshooting information for your environment:

- Local anvil testing:
  - Redeploy your local test using `--revert-strings debug` flag via the following commands and retest: `npm run deploy:core-debug && npm run deploy:volatility-data-avs-debug`
  - Analyze the full stacktrace from your error as a `.txt` file attachment.
- Holesky testing:
  - Ensure contracts are verified on Holesky. Eg `forge verify-contract --chain-id 17000 --num-of-optimizations 200 src/YourContract.sol:YourContract YOUR_CONTRACT_ADDRESS`

### Disclaimers

This repo is meant as a PoC project for the Uniswap hookathon to be used with _local anvil development testing_.
