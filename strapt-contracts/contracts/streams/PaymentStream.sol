// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PaymentStream
 * @notice Allows users to create token streams with customizable rates and milestones
 * @dev Supports ERC20 tokens with real-time streaming and milestone-based releases
 * @author STRAPT Team
 */
contract PaymentStream is ReentrancyGuard, Ownable {
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
     * @notice Helper function to create milestone array
     * @param milestonePercentages Array of milestone percentages
     * @param milestoneDescriptions Array of milestone descriptions
     * @return Array of Milestone structs
     */
    function _createMilestones(
        uint256[] calldata milestonePercentages,
        string[] calldata milestoneDescriptions
    ) private pure returns (Milestone[] memory) {
        Milestone[] memory streamMilestones = new Milestone[](milestonePercentages.length);

        for (uint256 i = 0; i < milestonePercentages.length; i++) {
            if (milestonePercentages[i] == 0 || milestonePercentages[i] >= 100) {
                revert InvalidMilestonePercentage();
            }
            streamMilestones[i] = Milestone({
                percentage: milestonePercentages[i],
                description: milestoneDescriptions[i],
                released: false
            });
        }

        return streamMilestones;
    }

    /**
     * @notice Helper function to generate stream ID
     * @param sender Address of the sender
     * @param recipient Address of the recipient
     * @param tokenAddress Address of the token
     * @param amount Amount of tokens
     * @return Stream ID
     */
    function _generateStreamId(
        address sender,
        address recipient,
        address tokenAddress,
        uint256 amount
    ) private view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                sender,
                recipient,
                tokenAddress,
                amount,
                block.timestamp
            )
        );
    }

    /**
     * @notice Create a new payment stream
     * @param recipient Address of the recipient
     * @param tokenAddress Address of the token to stream
     * @param amount Total amount to stream
     * @param duration Duration of the stream in seconds
     * @param milestonePercentages Array of milestone percentages (1-99)
     * @param milestoneDescriptions Array of milestone descriptions
     * @return streamId Unique ID of the created stream
     */
    function createStream(
        address recipient,
        address tokenAddress,
        uint256 amount,
        uint256 duration,
        uint256[] calldata milestonePercentages,
        string[] calldata milestoneDescriptions
    ) external nonReentrant returns (bytes32) {
        // Input validation
        if (tokenAddress == address(0)) revert InvalidTokenAddress();
        if (amount == 0) revert InvalidAmount();
        if (duration == 0) revert InvalidDuration();
        if (recipient == address(0) || recipient == msg.sender) revert InvalidRecipient();
        if (!supportedTokens[tokenAddress]) revert TokenNotSupported();
        if (milestonePercentages.length != milestoneDescriptions.length) revert InvalidMilestonePercentage();

        // Calculate fee
        uint256 fee = (amount * feeInBasisPoints) / 10000;
        uint256 transferAmount = amount - fee;

        // Generate stream ID
        bytes32 streamId = _generateStreamId(msg.sender, recipient, tokenAddress, amount);

        // Create milestones array
        Milestone[] memory streamMilestones = _createMilestones(milestonePercentages, milestoneDescriptions);

        // Create the stream record
        streams[streamId] = Stream({
            sender: msg.sender,
            recipient: recipient,
            tokenAddress: tokenAddress,
            amount: transferAmount,
            grossAmount: amount,
            streamed: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            lastUpdate: block.timestamp,
            status: StreamStatus.Active,
            milestones: streamMilestones
        });

        // Transfer tokens from sender to this contract
        IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), amount);

        // Transfer fee to fee collector if applicable
        if (fee > 0) {
            IERC20(tokenAddress).safeTransfer(feeCollector, fee);
        }

        emit StreamCreated(
            streamId,
            msg.sender,
            recipient,
            tokenAddress,
            transferAmount,
            amount,
            block.timestamp,
            block.timestamp + duration
        );

        return streamId;
    }

    /**
     * @notice Calculate the amount streamed so far
     * @param streamId ID of the stream
     * @return streamed Amount streamed so far
     */
    function getStreamedAmount(bytes32 streamId) public view returns (uint256) {
        Stream storage stream = streams[streamId];
        if (stream.sender == address(0)) revert StreamNotFound();

        if (stream.status != StreamStatus.Active) {
            return stream.streamed;
        }

        uint256 currentTime = block.timestamp;
        if (currentTime <= stream.lastUpdate) {
            return stream.streamed;
        }

        uint256 endTime = stream.endTime < currentTime ? stream.endTime : currentTime;
        uint256 timeElapsed = endTime - stream.lastUpdate;
        uint256 totalDuration = stream.endTime - stream.startTime;

        uint256 newlyStreamed = (stream.amount * timeElapsed) / totalDuration;
        uint256 totalStreamed = stream.streamed + newlyStreamed;

        // Cap at total amount
        return totalStreamed > stream.amount ? stream.amount : totalStreamed;
    }

    /**
     * @notice Update the stream status and streamed amount
     * @param streamId ID of the stream
     */
    function updateStream(bytes32 streamId) public {
        Stream storage stream = streams[streamId];
        if (stream.sender == address(0)) revert StreamNotFound();
        if (stream.status != StreamStatus.Active) return;

        uint256 currentTime = block.timestamp;
        if (currentTime <= stream.lastUpdate) return;

        uint256 newStreamedAmount = getStreamedAmount(streamId);
        stream.streamed = newStreamedAmount;
        stream.lastUpdate = currentTime;

        // Check if stream is completed
        if (currentTime >= stream.endTime) {
            stream.status = StreamStatus.Completed;
            stream.streamed = stream.amount;
            emit StreamCompleted(streamId, currentTime);
        }

        emit StreamUpdated(streamId, stream.streamed, stream.status, currentTime);
    }

    /**
     * @notice Pause a stream
     * @param streamId ID of the stream
     */
    function pauseStream(bytes32 streamId) external nonReentrant {
        Stream storage stream = streams[streamId];
        if (stream.sender == address(0)) revert StreamNotFound();
        if (stream.sender != msg.sender) revert NotStreamSender();
        if (stream.status != StreamStatus.Active) revert StreamNotActive();

        // Update stream before pausing
        updateStream(streamId);

        stream.status = StreamStatus.Paused;
        emit StreamPaused(streamId, block.timestamp);
    }

    /**
     * @notice Resume a paused stream
     * @param streamId ID of the stream
     */
    function resumeStream(bytes32 streamId) external nonReentrant {
        Stream storage stream = streams[streamId];
        if (stream.sender == address(0)) revert StreamNotFound();
        if (stream.sender != msg.sender) revert NotStreamSender();
        if (stream.status != StreamStatus.Paused) revert StreamAlreadyActive();

        // Calculate new end time based on remaining amount
        uint256 remainingAmount = stream.amount - stream.streamed;
        uint256 totalDuration = stream.endTime - stream.startTime;
        uint256 remainingDuration = (totalDuration * remainingAmount) / stream.amount;

        stream.startTime = block.timestamp;
        stream.endTime = block.timestamp + remainingDuration;
        stream.lastUpdate = block.timestamp;
        stream.status = StreamStatus.Active;

        emit StreamResumed(streamId, block.timestamp);
    }

    /**
     * @notice Cancel a stream
     * @param streamId ID of the stream
     */
    function cancelStream(bytes32 streamId) external nonReentrant {
        Stream storage stream = streams[streamId];
        if (stream.sender == address(0)) revert StreamNotFound();
        if (stream.sender != msg.sender) revert NotStreamSender();
        if (stream.status == StreamStatus.Completed) revert StreamAlreadyCompleted();
        if (stream.status == StreamStatus.Canceled) revert StreamAlreadyCanceled();

        // Update stream before canceling
        if (stream.status == StreamStatus.Active) {
            updateStream(streamId);
        }

        // Calculate refund amount
        uint256 refundAmount = stream.amount - stream.streamed;

        // Update stream status
        stream.status = StreamStatus.Canceled;

        // Transfer streamed amount to recipient
        if (stream.streamed > 0) {
            IERC20(stream.tokenAddress).safeTransfer(stream.recipient, stream.streamed);
        }

        // Refund remaining amount to sender
        if (refundAmount > 0) {
            IERC20(stream.tokenAddress).safeTransfer(stream.sender, refundAmount);
        }

        emit StreamCanceled(streamId, refundAmount, block.timestamp);
    }

    /**
     * @notice Release a milestone
     * @param streamId ID of the stream
     * @param milestoneIndex Index of the milestone to release
     */
    function releaseMilestone(bytes32 streamId, uint256 milestoneIndex) external nonReentrant {
        Stream storage stream = streams[streamId];
        if (stream.sender == address(0)) revert StreamNotFound();
        if (stream.sender != msg.sender) revert NotStreamSender();
        if (milestoneIndex >= stream.milestones.length) revert MilestoneIndexOutOfBounds();
        if (stream.milestones[milestoneIndex].released) revert MilestoneAlreadyReleased();

        // Update stream before releasing milestone
        if (stream.status == StreamStatus.Active) {
            updateStream(streamId);
        }

        // Mark milestone as released
        stream.milestones[milestoneIndex].released = true;

        // Calculate milestone amount
        uint256 milestonePercentage = stream.milestones[milestoneIndex].percentage;
        uint256 milestoneAmount = (stream.amount * milestonePercentage) / 100;

        // Ensure we don't exceed the total amount
        uint256 currentStreamed = stream.streamed;
        uint256 newStreamed = currentStreamed + milestoneAmount;
        if (newStreamed > stream.amount) {
            milestoneAmount = stream.amount - currentStreamed;
            newStreamed = stream.amount;
        }

        // Update streamed amount
        stream.streamed = newStreamed;

        // Check if stream is completed
        if (newStreamed >= stream.amount) {
            stream.status = StreamStatus.Completed;
            emit StreamCompleted(streamId, block.timestamp);
        }

        // Transfer milestone amount to recipient
        if (milestoneAmount > 0) {
            IERC20(stream.tokenAddress).safeTransfer(stream.recipient, milestoneAmount);
        }

        emit MilestoneReleased(streamId, milestoneIndex, milestoneAmount, block.timestamp);
    }

    /**
     * @notice Withdraw streamed tokens
     * @param streamId ID of the stream
     */
    function withdrawFromStream(bytes32 streamId) external nonReentrant {
        Stream storage stream = streams[streamId];
        if (stream.sender == address(0)) revert StreamNotFound();
        if (stream.recipient != msg.sender) revert NotStreamRecipient();

        // Update stream before withdrawal
        if (stream.status == StreamStatus.Active) {
            updateStream(streamId);
        }

        // Calculate withdrawable amount
        uint256 withdrawableAmount = stream.streamed;

        // Reset streamed amount
        stream.streamed = 0;

        // Transfer withdrawable amount to recipient
        if (withdrawableAmount > 0) {
            IERC20(stream.tokenAddress).safeTransfer(stream.recipient, withdrawableAmount);
        }

        emit StreamUpdated(streamId, 0, stream.status, block.timestamp);
    }

    /**
     * @notice Get stream details
     * @param streamId ID of the stream
     * @return sender Address of the stream creator
     * @return recipient Address of the stream recipient
     * @return tokenAddress Address of the token being streamed
     * @return amount Total amount to be streamed
     * @return streamed Amount streamed so far
     * @return startTime Timestamp when the stream started
     * @return endTime Timestamp when the stream will end
     * @return status Current status of the stream (0=Active, 1=Paused, 2=Completed, 3=Canceled)
     */
    function getStream(bytes32 streamId) external view returns (
        address sender,
        address recipient,
        address tokenAddress,
        uint256 amount,
        uint256 streamed,
        uint256 startTime,
        uint256 endTime,
        uint8 status
    ) {
        Stream storage stream = streams[streamId];
        if (stream.sender == address(0)) revert StreamNotFound();

        // Calculate real-time streamed amount
        uint256 currentStreamed = stream.status == StreamStatus.Active
            ? getStreamedAmount(streamId)
            : stream.streamed;

        return (
            stream.sender,
            stream.recipient,
            stream.tokenAddress,
            stream.amount,
            currentStreamed,
            stream.startTime,
            stream.endTime,
            uint8(stream.status)
        );
    }

    /**
     * @notice Get milestone details
     * @param streamId ID of the stream
     * @param milestoneIndex Index of the milestone
     * @return percentage Percentage of the milestone
     * @return description Description of the milestone
     * @return released Whether the milestone has been released
     */
    function getMilestone(bytes32 streamId, uint256 milestoneIndex) external view returns (
        uint256 percentage,
        string memory description,
        bool released
    ) {
        Stream storage stream = streams[streamId];
        if (stream.sender == address(0)) revert StreamNotFound();
        if (milestoneIndex >= stream.milestones.length) revert MilestoneIndexOutOfBounds();

        Milestone storage milestone = stream.milestones[milestoneIndex];
        return (
            milestone.percentage,
            milestone.description,
            milestone.released
        );
    }

    /**
     * @notice Get the number of milestones for a stream
     * @param streamId ID of the stream
     * @return count Number of milestones
     */
    function getMilestoneCount(bytes32 streamId) external view returns (uint256) {
        Stream storage stream = streams[streamId];
        if (stream.sender == address(0)) revert StreamNotFound();

        return stream.milestones.length;
    }
}
