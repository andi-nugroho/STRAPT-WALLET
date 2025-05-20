// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title USDCFaucet
 * @notice A faucet contract for distributing USDC tokens on the Lisk Sepolia testnet
 * @dev Allows users to claim a configurable amount of USDC with a cooldown period
 */
contract USDCFaucet is Ownable, ReentrancyGuard {
    IERC20 public immutable usdcToken;

    uint256 public claimAmount;
    uint256 public cooldownPeriod;
    uint256 public maxClaimPerAddress;

    mapping(address => uint256) public lastClaimTime;
    mapping(address => uint256) public totalClaimed;

    event TokensClaimed(address indexed recipient, uint256 amount);
    event ClaimAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event CooldownPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event MaxClaimPerAddressUpdated(uint256 oldMax, uint256 newMax);
    event TokensWithdrawn(address indexed to, uint256 amount);

    error CooldownNotExpired(uint256 timeRemaining);
    error MaxClaimLimitReached(uint256 claimed, uint256 maxAllowed);
    error InsufficientFaucetBalance(uint256 requested, uint256 available);
    error ZeroAddressNotAllowed();
    error ZeroAmountNotAllowed();

    /**
     * @notice Constructor to initialize the faucet
     * @param _usdcToken Address of the USDC token contract
     * @param _claimAmount Amount of tokens that can be claimed per request
     * @param _cooldownPeriod Time required between claims (in seconds)
     * @param _maxClaimPerAddress Maximum amount that can be claimed per address
     * @param initialOwner Address of the contract owner
     */
    constructor(
        address _usdcToken,
        uint256 _claimAmount,
        uint256 _cooldownPeriod,
        uint256 _maxClaimPerAddress,
        address initialOwner
    ) Ownable(initialOwner) {
        if (_usdcToken == address(0)) revert ZeroAddressNotAllowed();
        if (_claimAmount == 0) revert ZeroAmountNotAllowed();

        usdcToken = IERC20(_usdcToken);
        claimAmount = _claimAmount;
        cooldownPeriod = _cooldownPeriod;
        maxClaimPerAddress = _maxClaimPerAddress;
    }

    /**
     * @notice Allows a user to claim USDC tokens
     * @dev Enforces cooldown period and maximum claim limits
     */
    function claimTokens() external nonReentrant {
        // Check if cooldown period has passed
        if (block.timestamp < lastClaimTime[msg.sender] + cooldownPeriod) {
            revert CooldownNotExpired(
                (lastClaimTime[msg.sender] + cooldownPeriod) - block.timestamp
            );
        }

        // Check if user has reached maximum claim limit
        if (totalClaimed[msg.sender] + claimAmount > maxClaimPerAddress) {
            revert MaxClaimLimitReached(
                totalClaimed[msg.sender],
                maxClaimPerAddress
            );
        }

        // Check if faucet has enough balance
        uint256 faucetBalance = usdcToken.balanceOf(address(this));
        if (faucetBalance < claimAmount) {
            revert InsufficientFaucetBalance(claimAmount, faucetBalance);
        }

        // Update state
        lastClaimTime[msg.sender] = block.timestamp;
        totalClaimed[msg.sender] += claimAmount;

        // Transfer tokens
        bool success = usdcToken.transfer(msg.sender, claimAmount);
        require(success, "Token transfer failed");

        emit TokensClaimed(msg.sender, claimAmount);
    }

    /**
     * @notice Updates the amount of tokens that can be claimed
     * @param _newClaimAmount New claim amount
     */
    function setClaimAmount(uint256 _newClaimAmount) external onlyOwner {
        if (_newClaimAmount == 0) revert ZeroAmountNotAllowed();
        
        uint256 oldAmount = claimAmount;
        claimAmount = _newClaimAmount;
        
        emit ClaimAmountUpdated(oldAmount, _newClaimAmount);
    }

    /**
     * @notice Updates the cooldown period between claims
     * @param _newCooldownPeriod New cooldown period in seconds
     */
    function setCooldownPeriod(uint256 _newCooldownPeriod) external onlyOwner {
        uint256 oldPeriod = cooldownPeriod;
        cooldownPeriod = _newCooldownPeriod;
        
        emit CooldownPeriodUpdated(oldPeriod, _newCooldownPeriod);
    }

    /**
     * @notice Updates the maximum amount that can be claimed per address
     * @param _newMaxClaimPerAddress New maximum claim amount per address
     */
    function setMaxClaimPerAddress(uint256 _newMaxClaimPerAddress) external onlyOwner {
        if (_newMaxClaimPerAddress == 0) revert ZeroAmountNotAllowed();
        
        uint256 oldMax = maxClaimPerAddress;
        maxClaimPerAddress = _newMaxClaimPerAddress;
        
        emit MaxClaimPerAddressUpdated(oldMax, _newMaxClaimPerAddress);
    }

    /**
     * @notice Allows the owner to withdraw tokens from the faucet
     * @param _to Address to send tokens to
     * @param _amount Amount of tokens to withdraw
     */
    function withdrawTokens(address _to, uint256 _amount) external onlyOwner nonReentrant {
        if (_to == address(0)) revert ZeroAddressNotAllowed();
        if (_amount == 0) revert ZeroAmountNotAllowed();
        
        uint256 faucetBalance = usdcToken.balanceOf(address(this));
        uint256 withdrawAmount = Math.min(_amount, faucetBalance);
        
        bool success = usdcToken.transfer(_to, withdrawAmount);
        require(success, "Token transfer failed");
        
        emit TokensWithdrawn(_to, withdrawAmount);
    }

    /**
     * @notice Returns the time remaining until an address can claim again
     * @param _address The address to check
     * @return The time remaining in seconds, or 0 if can claim now
     */
    function timeUntilNextClaim(address _address) external view returns (uint256) {
        uint256 lastClaim = lastClaimTime[_address];
        if (lastClaim == 0) return 0;
        
        uint256 nextClaimTime = lastClaim + cooldownPeriod;
        if (block.timestamp >= nextClaimTime) return 0;
        
        return nextClaimTime - block.timestamp;
    }

    /**
     * @notice Returns the remaining amount a user can claim before hitting max limit
     * @param _address The address to check
     * @return The remaining amount that can be claimed
     */
    function remainingClaimAllowance(address _address) external view returns (uint256) {
        if (totalClaimed[_address] >= maxClaimPerAddress) return 0;
        return maxClaimPerAddress - totalClaimed[_address];
    }

    /**
     * @notice Returns the current faucet balance
     * @return The current USDC balance of the faucet
     */
    function getFaucetBalance() external view returns (uint256) {
        return usdcToken.balanceOf(address(this));
    }
}
