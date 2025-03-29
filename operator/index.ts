import { ethers } from "ethers";
import * as dotenv from "dotenv";
const fs = require("fs");
const path = require("path");
dotenv.config();

// TODO: this file should probably be deleted

// Check if the process.env object is empty
if (!Object.keys(process.env).length) {
  throw new Error("process.env object is empty");
}

// Setup env variables
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
/// TODO: Hack
let chainId = 31337;

const avsDeploymentData = JSON.parse(
  fs.readFileSync(
    path.resolve(
      __dirname,
      `../contracts/deployments/hello-world/${chainId}.json`
    ),
    "utf8"
  )
);
// Load core deployment data
const coreDeploymentData = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, `../contracts/deployments/core/${chainId}.json`),
    "utf8"
  )
);

const delegationManagerAddress = coreDeploymentData.addresses.delegationManager; // todo: reminder to fix the naming of this contract in the deployment file, change to delegationManager
const avsDirectoryAddress = coreDeploymentData.addresses.avsDirectory;
const volatilityDataServiceManagerAddress =
  avsDeploymentData.addresses.volatilityDataServiceManager;
const ecdsaStakeRegistryAddress = avsDeploymentData.addresses.stakeRegistry;

// Load ABIs
const delegationManagerABI = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../abis/IDelegationManager.json"),
    "utf8"
  )
);
const ecdsaRegistryABI = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../abis/ECDSAStakeRegistry.json"),
    "utf8"
  )
);
const volatilityDataServiceManagerABI = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../abis/VolatilityDataServiceManager.json"),
    "utf8"
  )
);
const avsDirectoryABI = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../abis/IAVSDirectory.json"), "utf8")
);

// Initialize contract objects from ABIs
const delegationManager = new ethers.Contract(
  delegationManagerAddress,
  delegationManagerABI,
  wallet
);
const volatilityDataServiceManager = new ethers.Contract(
  volatilityDataServiceManagerAddress,
  volatilityDataServiceManagerABI,
  wallet
);
const ecdsaRegistryContract = new ethers.Contract(
  ecdsaStakeRegistryAddress,
  ecdsaRegistryABI,
  wallet
);
const avsDirectory = new ethers.Contract(
  avsDirectoryAddress,
  avsDirectoryABI,
  wallet
);

const signAndSubmitVolatilityData = async () => {
  // TODO: re-add task index + operator signature
  const tx = await volatilityDataServiceManager.submitNewVolatilityData(12345);
  await tx.wait();
  console.log(`Responded to task.`);
};

const registerOperator = async () => {
  // Registers as an Operator in EigenLayer.
  try {
    const tx1 = await delegationManager.registerAsOperator(
      "0x0000000000000000000000000000000000000000", // initDelegationApprover
      0, // allocationDelay
      "" // metadataURI
    );
    await tx1.wait();
    console.log("Operator registered to Core EigenLayer contracts");
  } catch (error) {
    console.error("Error in registering as operator:", error);
  }

  const salt = ethers.hexlify(ethers.randomBytes(32));
  const expiry = Math.floor(Date.now() / 1000) + 3600; // Example expiry, 1 hour from now

  // Define the output structure
  let operatorSignatureWithSaltAndExpiry = {
    signature: "",
    salt: salt,
    expiry: expiry,
  };

  // Calculate the digest hash, which is a unique value representing the operator, avs, unique value (salt) and expiration date.
  const operatorDigestHash =
    await avsDirectory.calculateOperatorAVSRegistrationDigestHash(
      wallet.address,
      await volatilityDataServiceManager.getAddress(),
      salt,
      expiry
    );
  console.log(operatorDigestHash);

  // Sign the digest hash with the operator's private key
  console.log("Signing digest hash with operator's private key");
  const operatorSigningKey = new ethers.SigningKey(process.env.PRIVATE_KEY!);
  const operatorSignedDigestHash = operatorSigningKey.sign(operatorDigestHash);

  // Encode the signature in the required format
  operatorSignatureWithSaltAndExpiry.signature = ethers.Signature.from(
    operatorSignedDigestHash
  ).serialized;

  console.log("Registering Operator to AVS Registry contract");

  // Register Operator to AVS
  // Per release here: https://github.com/Layr-Labs/eigenlayer-middleware/blob/v0.2.1-mainnet-rewards/src/unaudited/ECDSAStakeRegistry.sol#L49
  const tx2 = await ecdsaRegistryContract.registerOperatorWithSignature(
    operatorSignatureWithSaltAndExpiry,
    wallet.address
  );
  await tx2.wait();
  console.log("Operator registered on AVS successfully");
};

const monitorNewTasks = async () => {
  volatilityDataServiceManager.on(
    "NewTaskCreated",
    async (taskIndex: number, task: any) => {
      console.log(`New task detected: Hello, ${task.name}`);
      await signAndSubmitVolatilityData();
    }
  );

  console.log("Monitoring for new tasks...");
};

const main = async () => {
  await registerOperator();
  monitorNewTasks().catch((error) => {
    console.error("Error monitoring tasks:", error);
  });
};

main().catch((error) => {
  console.error("Error in main function:", error);
});
