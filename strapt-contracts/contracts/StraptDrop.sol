// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title StraptDrop
 * @notice Contract for creating and claiming STRAPT Drops
 * @dev Users can create drops with fixed or random distribution of tokens
 * @author STRAPT Team
 */
contract StraptDrop is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // Custom errors for gas optimization
    error InvalidFeePercentage();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidRecipients();
    error InvalidExpiryTime();
    error DropNotActive();
    error DropExpired();
    error AllClaimsTaken();
    error AlreadyClaimed();
    error NotExpiredYet();
    error NotCreator();
    error TransferFailed();
    error DropNotFound();

    // Constants
    uint256 private constant BASIS_POINTS = 100;
    uint256 private constant MAX_FEE_PERCENTAGE = 50;
    uint256 private constant MIN_AMOUNT = 1;

    // Fee configuration
    uint256 public feePercentage = 10; // 0.1% (in basis points, 10000 = 100%)
    address public feeCollector;

    // Drop structure
    struct Drop {
        address creator;
        address tokenAddress;
        uint256 totalAmount;
        uint256 remainingAmount;
        uint256 claimedCount;
        uint256 totalRecipients;
        uint256 amountPerRecipient; // 0 if random
        bool isRandom;
        uint256 expiryTime;
        string message;
        bool isActive;
    }

    // Mappings
    mapping(bytes32 => Drop) public drops;
    mapping(bytes32 => mapping(address => bool)) public hasClaimed;
    mapping(bytes32 => mapping(address => uint256)) public claimedAmounts;

    // Events
    event DropCreated(
        bytes32 indexed dropId,
        address indexed creator,
        address indexed tokenAddress,
        uint256 totalAmount,
        uint256 totalRecipients,
        bool isRandom,
        string message
    );
    event DropClaimed(
        bytes32 indexed dropId,
        address indexed recipient,
        uint256 amount
    );
    event DropsExpired(
        bytes32 indexed dropId,
        address indexed creator,
        uint256 remainingAmount
    );
    event FeeCollected(
        bytes32 indexed dropId,
        address indexed tokenAddress,
        uint256 feeAmount
    );
    event FeePercentageUpdated(uint256 oldPercentage, uint256 newPercentage);
    event FeeCollectorUpdated(address oldCollector, address newCollector);

    /**
     * @dev Constructor sets the fee collector to the contract deployer
     */
    constructor() Ownable(msg.sender) {
        feeCollector = msg.sender;
    }

    /**
     * @notice Set the fee percentage (only owner)
     * @param _feePercentage New fee percentage in basis points (10000 = 100%)
     */
    function setFeePercentage(uint256 _feePercentage) external onlyOwner {
        if (_feePercentage > MAX_FEE_PERCENTAGE) revert InvalidFeePercentage();

        uint256 oldPercentage = feePercentage;
        feePercentage = _feePercentage;

        emit FeePercentageUpdated(oldPercentage, _feePercentage);
    }

    /**
     * @notice Set the fee collector address (only owner)
     * @param _feeCollector New fee collector address
     */
    function setFeeCollector(address _feeCollector) external onlyOwner {
        if (_feeCollector == address(0)) revert InvalidAddress();

        address oldCollector = feeCollector;
        feeCollector = _feeCollector;

        emit FeeCollectorUpdated(oldCollector, _feeCollector);
    }

    /**
     * @notice Create a new STRAPT Drop
     * @param tokenAddress Address of the ERC20 token
     * @param totalAmount Total amount of tokens to distribute
     * @param totalRecipients Number of recipients who can claim
     * @param isRandom Whether distribution is random or fixed
     * @param expiryTime Time when the drop expires (unix timestamp)
     * @param message Optional message for the drop
     * @return dropId Unique identifier for the created drop
     */
    function createDrop(
        address tokenAddress,
        uint256 totalAmount,
        uint256 totalRecipients,
        bool isRandom,
        uint256 expiryTime,
        string calldata message
    ) external nonReentrant returns (bytes32) {
        // Input validation
        if (totalAmount == 0) revert InvalidAmount();
        if (totalRecipients == 0) revert InvalidRecipients();
        if (expiryTime <= block.timestamp) revert InvalidExpiryTime();
        if (tokenAddress == address(0)) revert InvalidAddress();

        // Calculate fee
        uint256 feeAmount = (totalAmount * feePercentage) / BASIS_POINTS;
        uint256 netAmount = totalAmount - feeAmount;

        // Transfer tokens from sender to contract
        IERC20 token = IERC20(tokenAddress);
        token.safeTransferFrom(msg.sender, address(this), totalAmount);

        // Transfer fee to fee collector
        if (feeAmount > 0) {
            token.safeTransfer(feeCollector, feeAmount);
            emit FeeCollected(bytes32(0), tokenAddress, feeAmount);
        }

        // Generate unique drop ID
        bytes32 dropId = keccak256(abi.encodePacked(
            msg.sender,
            block.timestamp,
            totalAmount,
            totalRecipients,
            tokenAddress
        ));

        // Calculate amount per recipient if fixed distribution
        uint256 amountPerRecipient = isRandom ? 0 : netAmount / totalRecipients;

        // Create drop
        drops[dropId] = Drop({
            creator: msg.sender,
            tokenAddress: tokenAddress,
            totalAmount: netAmount,
            remainingAmount: netAmount,
            claimedCount: 0,
            totalRecipients: totalRecipients,
            amountPerRecipient: amountPerRecipient,
            isRandom: isRandom,
            expiryTime: expiryTime,
            message: message,
            isActive: true
        });

        emit DropCreated(
            dropId,
            msg.sender,
            tokenAddress,
            netAmount,
            totalRecipients,
            isRandom,
            message
        );

        return dropId;
    }

    /**
     * @notice Claim tokens from a STRAPT Drop
     * @param dropId Unique identifier of the drop
     * @return amount Amount of tokens claimed
     */
    function claimDrop(bytes32 dropId) external nonReentrant returns (uint256) {
        Drop storage drop = drops[dropId];

        // Check if drop exists
        if (drop.creator == address(0)) revert DropNotFound();

        // Validate drop state
        if (!drop.isActive) revert DropNotActive();
        if (block.timestamp >= drop.expiryTime) revert DropExpired();
        if (drop.claimedCount >= drop.totalRecipients) revert AllClaimsTaken();
        if (hasClaimed[dropId][msg.sender]) revert AlreadyClaimed();

        uint256 amountToSend;

        if (drop.isRandom) {
            amountToSend = _calculateRandomAmount(dropId, drop);
        } else {
            // Fixed distribution
            amountToSend = drop.amountPerRecipient;
        }

        // Update state
        drop.remainingAmount -= amountToSend;
        drop.claimedCount += 1;
        hasClaimed[dropId][msg.sender] = true;
        claimedAmounts[dropId][msg.sender] = amountToSend;

        // If all claimed, mark as inactive
        if (drop.claimedCount == drop.totalRecipients) {
            drop.isActive = false;
        }

        // Transfer tokens to claimer
        IERC20 token = IERC20(drop.tokenAddress);
        token.safeTransfer(msg.sender, amountToSend);

        emit DropClaimed(dropId, msg.sender, amountToSend);

        return amountToSend;
    }

    /**
     * @notice Refund remaining tokens from an expired drop
     * @param dropId Unique identifier of the drop
     * @return amount Amount of tokens refunded
     */
    function refundExpiredDrop(bytes32 dropId) external nonReentrant returns (uint256) {
        Drop storage drop = drops[dropId];

        // Check if drop exists
        if (drop.creator == address(0)) revert DropNotFound();

        if (!drop.isActive) revert DropNotActive();
        if (block.timestamp < drop.expiryTime) revert NotExpiredYet();
        if (drop.creator != msg.sender) revert NotCreator();

        uint256 remainingAmount = drop.remainingAmount;

        // Update state
        drop.remainingAmount = 0;
        drop.isActive = false;

        // Transfer tokens back to creator
        IERC20 token = IERC20(drop.tokenAddress);
        token.safeTransfer(drop.creator, remainingAmount);

        emit DropsExpired(dropId, drop.creator, remainingAmount);

        return remainingAmount;
    }

    /**
     * @notice Calculate random amount for a claim
     * @dev Internal function to calculate random amount for a claim
     * @param dropId Unique identifier of the drop
     * @param drop Drop storage reference
     * @return amountToSend Amount to send to the claimer
     */
    function _calculateRandomAmount(bytes32 dropId, Drop storage drop) private view returns (uint256) {
        uint256 amountToSend;

        if (drop.claimedCount == drop.totalRecipients - 1) {
            // Last person gets the remainder
            amountToSend = drop.remainingAmount;
        } else {
            // Use a fair random algorithm
            uint256 remainingRecipients = drop.totalRecipients - drop.claimedCount;
            uint256 averageAmount = drop.remainingAmount / remainingRecipients;
            uint256 maxPossible = Math.min(averageAmount * 2, drop.remainingAmount);

            // Generate random number using keccak256
            uint256 randomFactor = uint256(keccak256(abi.encodePacked(
                block.timestamp,
                msg.sender,
                dropId,
                drop.claimedCount
            ))) % 100;

            // Calculate random amount between 1% and 200% of average
            amountToSend = (averageAmount * (randomFactor + 100)) / 100;

            // Ensure amount is within bounds
            amountToSend = Math.min(amountToSend, maxPossible);
            amountToSend = Math.max(amountToSend, MIN_AMOUNT); // Ensure at least 1 token unit
        }

        return amountToSend;
    }

    /**
     * @notice Get information about a drop
     * @param dropId Unique identifier of the drop
     * @return creator Creator of the drop
     * @return tokenAddress Address of the token
     * @return totalAmount Total amount of tokens in the drop
     * @return remainingAmount Remaining amount of tokens
     * @return claimedCount Number of claims made
     * @return totalRecipients Total number of recipients
     * @return isRandom Whether distribution is random
     * @return expiryTime Time when the drop expires
     * @return message Optional message for the drop
     * @return isActive Whether the drop is active
     */
    function getDropInfo(bytes32 dropId) external view returns (
        address creator,
        address tokenAddress,
        uint256 totalAmount,
        uint256 remainingAmount,
        uint256 claimedCount,
        uint256 totalRecipients,
        bool isRandom,
        uint256 expiryTime,
        string memory message,
        bool isActive
    ) {
        Drop storage drop = drops[dropId];

        // Check if drop exists by verifying creator is not zero address
        // This works because we validate creator != address(0) during creation
        if (drop.creator == address(0)) {
            revert DropNotFound();
        }

        return (
            drop.creator,
            drop.tokenAddress,
            drop.totalAmount,
            drop.remainingAmount,
            drop.claimedCount,
            drop.totalRecipients,
            drop.isRandom,
            drop.expiryTime,
            drop.message,
            drop.isActive
        );
    }

    /**
     * @notice Check if an address has claimed from a drop
     * @param dropId Unique identifier of the drop
     * @param user Address to check
     * @return claimed Whether the address has claimed
     */
    function hasAddressClaimed(bytes32 dropId, address user) external view returns (bool claimed) {
        // Check if drop exists
        if (drops[dropId].creator == address(0)) {
            revert DropNotFound();
        }
        return hasClaimed[dropId][user];
    }

    /**
     * @notice Get amount claimed by an address from a drop
     * @param dropId Unique identifier of the drop
     * @param user Address to check
     * @return amount Amount claimed
     */
    function getClaimedAmount(bytes32 dropId, address user) external view returns (uint256 amount) {
        // Check if drop exists
        if (drops[dropId].creator == address(0)) {
            revert DropNotFound();
        }
        return claimedAmounts[dropId][user];
    }
}
