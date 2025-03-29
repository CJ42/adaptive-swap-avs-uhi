// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// modules
import {ECDSAServiceManagerBase} from "@eigenlayer-middleware/src/unaudited/ECDSAServiceManagerBase.sol";
import {MockServiceManagerImplementation} from "./MockServiceManagerImplementation.sol";

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
    struct VolatilityData {
        int256 minute;
        int256 hour;
        int256 day;
        int256 weightedAverage;
        uint256 timestamp;
    }

    mapping(uint256 dataId => VolatilityData) internal _volatilityData;

    uint256 public volatilityDataCount;

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
        VolatilityData memory volatility
    ) external {
        uint256 newDataId = ++volatilityDataCount;

        // CHECK that we are not submitting invalid data in the past
        require(
            _volatilityData[newDataId].timestamp < volatility.timestamp,
            "Invalid timestamp submitted"
        );

        _volatilityData[newDataId] = volatility;

        // TODO: emit an event that includes the operator that submitted this data
        // emit VolatilityDataSubmitted(
        //     latestDataId,
        //     volatility.minute,
        //     volatility.hour,
        //     volatility.day,
        //     volatility.weightedAverage,
        //     volatility.timestamp
        // );
    }

    /// @dev This is consumed by the Uniswap v4 Hook contract

    function getLatestVolatilityData()
        external
        view
        returns (VolatilityData memory)
    {
        return _volatilityData[volatilityDataCount];
    }
}
