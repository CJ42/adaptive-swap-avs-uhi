// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// modules
import {ECDSAServiceManagerBase} from "@eigenlayer-middleware/src/unaudited/ECDSAServiceManagerBase.sol";
import {MockServiceManagerImplementation} from "./MockServiceManagerImplementation.sol";
import {ECDSAStakeRegistry} from "@eigenlayer-middleware/src/unaudited/ECDSAStakeRegistry.sol";

// interfaces
import {IServiceManager} from "@eigenlayer-middleware/src/interfaces/IServiceManager.sol";

/**
 * @title Primary entrypoint for providing market volatility data to smart contracts (e.g: Adaptive Swap).
 * @author CJ42
 */
contract VolatilityDataServiceManager is
    ECDSAServiceManagerBase,
    MockServiceManagerImplementation
{
    event VolatilityDataSubmitted(
        address operator,
        uint256 indexed dataId,
        VolatilityData volatilityData
    );
    struct VolatilityData {
        int256 minute;
        int256 hour;
        int256 day;
        int256 weightedAverage;
        uint256 timestamp;
    }

    mapping(uint256 dataId => VolatilityData) internal _volatilityData;

    uint256 public volatilityDataCount;

    modifier onlyOperator() {
        require(
            ECDSAStakeRegistry(stakeRegistry).operatorRegistered(msg.sender),
            "Operator must be the caller"
        );
        _;
    }

    constructor(
        address _avsDirectory,
        address _stakeRegistry,
        address _rewardsCoordinator,
        address _delegationManager,
        address _allocationManager
    )
        ECDSAServiceManagerBase(
            _avsDirectory,
            _stakeRegistry,
            _rewardsCoordinator,
            _delegationManager,
            _allocationManager
        )
    {}

    function initialize(
        address initialOwner_,
        address rewardsInitiator_
    ) external initializer {
        __ServiceManagerBase_init(initialOwner_, rewardsInitiator_);
    }

    /// @dev This is submitted by the AVS operator
    function submitNewVolatilityData(
        VolatilityData memory volatilityData
    ) external onlyOperator {
        uint256 newDataId = ++volatilityDataCount;

        // CHECK that we are not submitting invalid data in the past
        require(
            _volatilityData[newDataId].timestamp < volatilityData.timestamp,
            "Invalid timestamp submitted"
        );

        _volatilityData[newDataId] = volatilityData;

        // emit event that includes the operator that submitted this data
        emit VolatilityDataSubmitted(msg.sender, newDataId, volatilityData);
    }

    /// @dev This is consumed by the Uniswap v4 Hook contract
    function getLatestVolatilityData() external view returns (int256) {
        return _volatilityData[volatilityDataCount].weightedAverage;
    }
}
