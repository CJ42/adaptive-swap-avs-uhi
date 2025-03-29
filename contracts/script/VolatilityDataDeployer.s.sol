// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// std lib
import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/Test.sol";
import "forge-std/Test.sol";

// libraries
import {VolatilityDataDeploymentLib} from "./utils/VolatilityDataDeploymentLib.sol";
import {CoreDeploymentLib, CoreDeploymentParsingLib} from "./utils/CoreDeploymentLib.sol";
import {UpgradeableProxyLib} from "./utils/UpgradeableProxyLib.sol";

// Eigenlayer contracts
import {StrategyBase} from "@eigenlayer/contracts/strategies/StrategyBase.sol";
import {ERC20Mock} from "../test/ERC20Mock.sol";
import {StrategyFactory} from "@eigenlayer/contracts/strategies/StrategyFactory.sol";
import {StrategyManager} from "@eigenlayer/contracts/core/StrategyManager.sol";
import {IRewardsCoordinator} from "@eigenlayer/contracts/interfaces/IRewardsCoordinator.sol";
import {IECDSAStakeRegistryTypes, IStrategy} from "@eigenlayer-middleware/src/interfaces/IECDSAStakeRegistry.sol";

// Proxy contracts
import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract VolatilityDataDeployer is Script, Test {
    using CoreDeploymentLib for *;
    using UpgradeableProxyLib for address;

    address private deployer;
    address proxyAdmin;
    address rewardsOwner;
    address rewardsInitiator;

    IStrategy volatilityDataStrategy;
    CoreDeploymentLib.DeploymentData coreDeployment;
    VolatilityDataDeploymentLib.DeploymentData volatilityDataDeployment;
    VolatilityDataDeploymentLib.DeploymentConfigData volatilityDataConfig;
    IECDSAStakeRegistryTypes.Quorum internal quorum;
    ERC20Mock token;

    function setUp() public virtual {
        deployer = vm.rememberKey(vm.envUint("PRIVATE_KEY"));
        vm.label(deployer, "Deployer");

        volatilityDataConfig = VolatilityDataDeploymentLib
            .readDeploymentConfigValues(
                "config/volatility-data/",
                block.chainid
            );

        coreDeployment = CoreDeploymentParsingLib.readDeploymentJson(
            "deployments/core/",
            block.chainid
        );
    }

    function run() external {
        vm.startBroadcast(deployer);
        rewardsOwner = volatilityDataConfig.rewardsOwner;
        rewardsInitiator = volatilityDataConfig.rewardsInitiator;

        token = new ERC20Mock();
        // NOTE: if this fails, it's because the initialStrategyWhitelister is not set to be the StrategyFactory
        // TODO: because this line reverting
        volatilityDataStrategy = IStrategy(
            StrategyFactory(coreDeployment.strategyFactory).deployNewStrategy(
                token
            )
        );

        quorum.strategies.push(
            IECDSAStakeRegistryTypes.StrategyParams({
                strategy: volatilityDataStrategy,
                multiplier: 10_000
            })
        );

        proxyAdmin = UpgradeableProxyLib.deployProxyAdmin();

        volatilityDataDeployment = VolatilityDataDeploymentLib.deployContracts(
            proxyAdmin,
            coreDeployment,
            quorum,
            rewardsInitiator,
            rewardsOwner
        );

        volatilityDataDeployment.strategy = address(volatilityDataStrategy);
        volatilityDataDeployment.token = address(token);

        vm.stopBroadcast();
        verifyDeployment();
        VolatilityDataDeploymentLib.writeDeploymentJson(
            volatilityDataDeployment
        );
    }

    function verifyDeployment() internal view {
        require(
            volatilityDataDeployment.stakeRegistry != address(0),
            "StakeRegistry address cannot be zero"
        );
        require(
            volatilityDataDeployment.volatilityDataServiceManager != address(0),
            "VolatilityDataServiceManager address cannot be zero"
        );
        require(
            volatilityDataDeployment.strategy != address(0),
            "Strategy address cannot be zero"
        );
        require(proxyAdmin != address(0), "ProxyAdmin address cannot be zero");
        require(
            coreDeployment.delegationManager != address(0),
            "DelegationManager address cannot be zero"
        );
        require(
            coreDeployment.avsDirectory != address(0),
            "AVSDirectory address cannot be zero"
        );
    }
}
