// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PaymentStreamFix
 * @notice Fixed version of PaymentStream contract that handles token balance issues
 * @dev Adds balance checks before transfers to prevent "transfer amount exceeds balance" errors
 * @author STRAPT Team
 */
contract PaymentStreamFix is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    /// @notice Enum to track the status of a stream
    enum StreamStatus {
        Active,     // 0: Stream is active and tokens are being streamed
        Paused,     // 1: Stream is paused and tokens are not being streamed
        Completed,  // 2: Stream has been completed (all tokens streamed)
        Canceled    // 3: Stream has been canceled by sender
    }

    /// @notice Struct to store milestone information
    struct Milestone {
        uint256 percentage;    // Percentage of total amount (1-99)
        string description;    // Description of the milestone
        bool released;         // Whether the milestone has been released
    }

    /// @notice Struct to store stream information
    struct Stream {
        address sender;        // Address of the stream creator
        address recipient;     // Address of the stream recipient
        address tokenAddress;  // Address of the token being streamed
        uint256 amount;        // Total amount to be streamed (after fee)
        uint256 grossAmount;   // Original amount before fee
        uint256 streamed;      // Amount streamed so far
        uint256 startTime;     // Timestamp when the stream started
        uint256 endTime;       // Timestamp when the stream will end
        uint256 lastUpdate;    // Timestamp of the last update
        StreamStatus status;   // Current status of the stream
        Milestone[] milestones; // Array of milestones
    }

    /// @notice Fee collector address
    address public feeCollector;

    /// @notice Fee in basis points (1/100 of a percent, e.g. 20 = 0.2%)
    uint16 public feeInBasisPoints;

    /// @notice Maximum fee in basis points (5%)
    uint16 public constant MAX_FEE = 500;

    /// @notice Mapping of stream ID to stream
    mapping(bytes32 => Stream) public streams;

    /// @notice Mapping of token address to whether it's supported
    mapping(address => bool) public supportedTokens;

    /// @notice Event emitted when a stream is created
    event StreamCreated(
        bytes32 indexed streamId,
        address indexed sender,
        address indexed recipient,
        address tokenAddress,
        uint256 amount,
        uint256 grossAmount,
        uint256 startTime,
        uint256 endTime
    );

    /// @notice Event emitted when a stream is updated
    event StreamUpdated(
        bytes32 indexed streamId,
        uint256 streamed,
        StreamStatus status,
        uint256 timestamp
    );

    /// @notice Event emitted when a milestone is released
    event MilestoneReleased(
        bytes32 indexed streamId,
        uint256 milestoneIndex,
        uint256 amount,
        uint256 timestamp
    );

    /// @notice Event emitted when a stream is paused
    event StreamPaused(
        bytes32 indexed streamId,
        uint256 timestamp
    );

    /// @notice Event emitted when a stream is resumed
    event StreamResumed(
        bytes32 indexed streamId,
        uint256 timestamp
    );

    /// @notice Event emitted when a stream is canceled
    event StreamCanceled(
        bytes32 indexed streamId,
        uint256 refundAmount,
        uint256 timestamp
    );

    /// @notice Event emitted when a stream is completed
    event StreamCompleted(
        bytes32 indexed streamId,
        uint256 timestamp
    );

    /// @notice Custom errors for gas optimization
    error InvalidTokenAddress();
    error InvalidAmount();
    error InvalidDuration();
    error InvalidRecipient();
    error TokenNotSupported();
    error StreamNotFound();
    error NotStreamSender();
    error NotStreamRecipient();
    error StreamNotActive();
    error StreamAlreadyActive();
    error StreamAlreadyPaused();
    error StreamAlreadyCompleted();
    error StreamAlreadyCanceled();
    error MilestoneAlreadyReleased();
    error MilestoneIndexOutOfBounds();
    error InvalidMilestonePercentage();
    error InvalidFee();
    error InsufficientContractBalance();
    error NoFundsToWithdraw();

    /**
     * @notice Constructor to initialize the contract
     * @param _feeCollector Address that will receive fees
     * @param _feeInBasisPoints Fee in basis points (1/100 of a percent)
     */
    constructor(address _feeCollector, uint16 _feeInBasisPoints) Ownable(msg.sender) {
        if (_feeInBasisPoints > MAX_FEE) revert InvalidFee();
        feeCollector = _feeCollector;
        feeInBasisPoints = _feeInBasisPoints;
    }

    /**
     * @notice Set the fee collector address
     * @param _feeCollector New fee collector address
     */
    function setFeeCollector(address _feeCollector) external onlyOwner {
        feeCollector = _feeCollector;
    }

    /**
     * @notice Set the fee in basis points
     * @param _feeInBasisPoints New fee in basis points
     */
    function setFeeInBasisPoints(uint16 _feeInBasisPoints) external onlyOwner {
        if (_feeInBasisPoints > MAX_FEE) revert InvalidFee();
        feeInBasisPoints = _feeInBasisPoints;
    }

    /**
     * @notice Set whether a token is supported
     * @param tokenAddress Address of the token
     * @param isSupported Whether the token is supported
     */
    function setTokenSupport(address tokenAddress, bool isSupported) external onlyOwner {
        supportedTokens[tokenAddress] = isSupported;
    }

    /**
     * @notice Helper function to safely transfer tokens
     * @param token Token to transfer
     * @param to Recipient address
     * @param amount Amount to transfer
     * @return The actual amount transferred (may be less than requested if contract balance is insufficient)
     */
    function _safeTransferToken(IERC20 token, address to, uint256 amount) private returns (uint256) {
        // Check contract balance
        uint256 contractBalance = token.balanceOf(address(this));
        
        // If contract has less than requested amount, transfer what we have
        uint256 transferAmount = amount;
        if (contractBalance < amount) {
            transferAmount = contractBalance;
        }
        
        // Only transfer if there's something to transfer
        if (transferAmount > 0) {
            token.safeTransfer(to, transferAmount);
        }
        
        return transferAmount;
    }

    /**
     * @notice Withdraw streamed tokens
     * @param streamId ID of the stream
     * @return The amount actually withdrawn
     */
    function withdrawFromStream(bytes32 streamId) external nonReentrant returns (uint256) {
        Stream storage stream = streams[streamId];
        if (stream.sender == address(0)) revert StreamNotFound();
        if (stream.recipient != msg.sender) revert NotStreamRecipient();

        // Update stream before withdrawal
        if (stream.status == StreamStatus.Active) {
            updateStream(streamId);
        }

        // Calculate withdrawable amount
        uint256 withdrawableAmount = stream.streamed;
        
        // Check if there's anything to withdraw
        if (withdrawableAmount == 0) revert NoFundsToWithdraw();

        // Reset streamed amount
        stream.streamed = 0;

        // Transfer withdrawable amount to recipient (safely)
        IERC20 token = IERC20(stream.tokenAddress);
        uint256 actualWithdrawn = _safeTransferToken(token, stream.recipient, withdrawableAmount);
        
        // If we couldn't transfer the full amount, update the streamed amount to reflect what's left
        if (actualWithdrawn < withdrawableAmount) {
            stream.streamed = withdrawableAmount - actualWithdrawn;
        }

        emit StreamUpdated(streamId, stream.streamed, stream.status, block.timestamp);
        
        return actualWithdrawn;
    }
}
