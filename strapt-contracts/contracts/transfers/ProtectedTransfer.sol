// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";


/** THIS IS A DEPRECATED CONTRACT (V1) */

/**
 * @title ProtectedTransfer
 * @notice Allows users to send tokens with protection mechanisms like claim codes and expiry times
 * @dev Supports ERC20 tokens like IDRX and USDC with gas-optimized operations
 * @author STRAPT Team
 */
contract ProtectedTransfer is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    /// @notice Enum to track the status of a transfer
    enum TransferStatus {
        Pending,    // 0: Transfer is created but not claimed
        Claimed,    // 1: Transfer has been claimed by recipient
        Refunded,   // 2: Transfer has been refunded to sender
        Expired     // 3: Transfer has expired (not used yet, for future auto-expiry)
    }

    /// @notice Struct to store transfer details
    struct Transfer {
        address sender;         // Creator of the transfer
        address recipient;      // Optional: can be zero address for link/QR transfers
        address tokenAddress;   // ERC20 token address
        uint256 amount;         // Net amount of tokens to transfer (after fee)
        uint256 grossAmount;    // Original amount before fee deduction
        uint256 expiry;         // Timestamp after which transfer can be refunded
        bytes32 claimCodeHash;  // Hash of the claim code (can be empty for link transfers)
        TransferStatus status;  // Current status of the transfer
        uint256 createdAt;      // Timestamp when transfer was created
        bool isLinkTransfer;    // Whether this is a link transfer (true) or code transfer (false)
    }

    /// @notice Mapping from transfer ID to Transfer struct
    mapping(bytes32 => Transfer) public transfers;

    /// @notice Whitelist of supported tokens (for future use)
    mapping(address => bool) public supportedTokens;

    /// @notice Fee percentage in basis points (1/100 of a percent, e.g. 25 = 0.25%)
    uint16 public feeInBasisPoints;

    /// @notice Address where fees are collected
    address public feeCollector;

    /// @notice Minimum expiry time in seconds
    uint256 public constant MIN_EXPIRY_TIME = 5 minutes;

    /// @notice Maximum expiry time in seconds
    uint256 public constant MAX_EXPIRY_TIME = 30 days;

    /// @notice Maximum fee in basis points (1%)
    uint16 public constant MAX_FEE = 100;

    /// @notice Emitted when a new transfer is created
    event TransferCreated(
        bytes32 indexed transferId,
        address indexed sender,
        address indexed recipient,
        address tokenAddress,
        uint256 amount,
        uint256 grossAmount,
        uint256 expiry
    );

    /// @notice Emitted when a transfer is claimed
    event TransferClaimed(
        bytes32 indexed transferId,
        address indexed claimer,
        uint256 amount
    );

    /// @notice Emitted when a transfer is refunded
    event TransferRefunded(
        bytes32 indexed transferId,
        address indexed sender,
        uint256 amount
    );

    /// @notice Emitted when a token is added to or removed from the whitelist
    event TokenWhitelistUpdated(address indexed token, bool isSupported);

    /// @notice Emitted when the fee is updated
    event FeeUpdated(uint16 oldFee, uint16 newFee);

    /// @notice Emitted when the fee collector is updated
    event FeeCollectorUpdated(address oldCollector, address newCollector);

    /// @notice Custom errors for gas optimization
    error InvalidTokenAddress();
    error InvalidAmount();
    error InvalidExpiryTime();
    error TransferAlreadyExists();
    error TransferDoesNotExist();
    error TransferNotClaimable();
    error TransferExpired();
    error InvalidClaimCode();
    error NotIntendedRecipient();
    error TransferNotRefundable();
    error TransferNotExpired();
    error NotTransferSender();
    error FeeExceedsMaximum();
    error InvalidFeeCollector();
    error TokenNotSupported();
    error NotLinkTransfer();
    error PasswordProtected();
    error PasswordRequired();

    /**
     * @notice Contract constructor
     * @param initialOwner The initial owner of the contract
     * @param initialFeeCollector The initial fee collector address
     * @param initialFeeInBasisPoints The initial fee in basis points
     */
    constructor(
        address initialOwner,
        address initialFeeCollector,
        uint16 initialFeeInBasisPoints
    ) Ownable(initialOwner) {
        if (initialFeeInBasisPoints > MAX_FEE) revert FeeExceedsMaximum();
        if (initialFeeCollector == address(0)) revert InvalidFeeCollector();

        feeInBasisPoints = initialFeeInBasisPoints;
        feeCollector = initialFeeCollector;
    }

    /**
     * @notice Creates a protected transfer with a claim code
     * @param recipient The recipient address (can be zero for link/QR transfers)
     * @param tokenAddress The ERC20 token address to transfer
     * @param amount The amount of tokens to transfer
     * @param expiry The timestamp after which the transfer can be refunded
     * @param claimCodeHash The hash of the claim code (keccak256)
     * @return transferId The unique ID of the created transfer
     */
    function createTransfer(
        address recipient,
        address tokenAddress,
        uint256 amount,
        uint256 expiry,
        bytes32 claimCodeHash
    ) external nonReentrant returns (bytes32) {
        // Input validation with custom errors for gas optimization
        if (tokenAddress == address(0)) revert InvalidTokenAddress();
        if (amount == 0) revert InvalidAmount();

        // Validate expiry time is within allowed range
        if (expiry <= block.timestamp + MIN_EXPIRY_TIME ||
            expiry > block.timestamp + MAX_EXPIRY_TIME) {
            revert InvalidExpiryTime();
        }

        // Generate a unique transfer ID
        bytes32 transferId = _generateTransferId(
            msg.sender,
            recipient,
            tokenAddress,
            amount,
            expiry,
            claimCodeHash
        );

        // Ensure transfer ID doesn't already exist
        if (transfers[transferId].createdAt != 0) revert TransferAlreadyExists();

        // Calculate fee if applicable
        uint256 fee = 0;
        uint256 transferAmount = amount;

        if (feeInBasisPoints > 0) {
            fee = (amount * feeInBasisPoints) / 10000;
            transferAmount = amount - fee;
        }

        // Create the transfer record
        transfers[transferId] = Transfer({
            sender: msg.sender,
            recipient: recipient,
            tokenAddress: tokenAddress,
            amount: transferAmount, // Store the net amount after fee
            grossAmount: amount,    // Store the original amount before fee
            expiry: expiry,
            claimCodeHash: claimCodeHash,
            status: TransferStatus.Pending,
            createdAt: block.timestamp,
            isLinkTransfer: false
        });

        // Transfer tokens from sender to this contract
        IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), amount);

        // Transfer fee to fee collector if applicable
        if (fee > 0) {
            IERC20(tokenAddress).safeTransfer(feeCollector, fee);
        }

        emit TransferCreated(
            transferId,
            msg.sender,
            recipient,
            tokenAddress,
            transferAmount,
            amount,
            expiry
        );

        return transferId;
    }

    /**
     * @notice Creates a link/QR transfer that can be claimed with just the transfer ID
     * @param tokenAddress The ERC20 token address to transfer
     * @param amount The amount of tokens to transfer
     * @param expiry The timestamp after which the transfer can be refunded
     * @return transferId The unique ID of the created transfer (to be shared as link/QR)
     */
    function createLinkTransfer(
        address tokenAddress,
        uint256 amount,
        uint256 expiry
    ) external nonReentrant returns (bytes32) {
        // Input validation with custom errors for gas optimization
        if (tokenAddress == address(0)) revert InvalidTokenAddress();
        if (amount == 0) revert InvalidAmount();

        // Validate expiry time is within allowed range
        if (expiry <= block.timestamp + MIN_EXPIRY_TIME ||
            expiry > block.timestamp + MAX_EXPIRY_TIME) {
            revert InvalidExpiryTime();
        }

        // Generate a unique transfer ID with additional randomness
        bytes32 transferId = keccak256(
            abi.encodePacked(
                msg.sender,
                tokenAddress,
                amount,
                expiry,
                block.timestamp,
                blockhash(block.number - 1), // Add block hash for more randomness
                address(this)                // Add contract address for uniqueness
            )
        );

        // Ensure transfer ID doesn't already exist
        if (transfers[transferId].createdAt != 0) revert TransferAlreadyExists();

        // Calculate fee if applicable
        uint256 fee = 0;
        uint256 transferAmount = amount;

        if (feeInBasisPoints > 0) {
            fee = (amount * feeInBasisPoints) / 10000;
            transferAmount = amount - fee;
        }

        // Create the transfer record - note this is a link transfer with no recipient
        transfers[transferId] = Transfer({
            sender: msg.sender,
            recipient: address(0),          // No specific recipient for link transfers
            tokenAddress: tokenAddress,
            amount: transferAmount,         // Store the net amount after fee
            grossAmount: amount,            // Store the original amount before fee
            expiry: expiry,
            claimCodeHash: bytes32(0),      // No claim code for link transfers
            status: TransferStatus.Pending,
            createdAt: block.timestamp,
            isLinkTransfer: true            // Mark as link transfer
        });

        // Transfer tokens from sender to this contract
        IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), amount);

        // Transfer fee to fee collector if applicable
        if (fee > 0) {
            IERC20(tokenAddress).safeTransfer(feeCollector, fee);
        }

        emit TransferCreated(
            transferId,
            msg.sender,
            address(0),                     // No specific recipient
            tokenAddress,
            transferAmount,
            amount,
            expiry
        );

        return transferId;
    }

    /**
     * @notice Creates a password-protected link/QR transfer that requires a claim code
     * @param tokenAddress The ERC20 token address to transfer
     * @param amount The amount of tokens to transfer
     * @param expiry The timestamp after which the transfer can be refunded
     * @param claimCodeHash The hash of the claim code (keccak256)
     * @return transferId The unique ID of the created transfer (to be shared as link/QR)
     */
    function createProtectedLinkTransfer(
        address tokenAddress,
        uint256 amount,
        uint256 expiry,
        bytes32 claimCodeHash
    ) external nonReentrant returns (bytes32) {
        // Input validation with custom errors for gas optimization
        if (tokenAddress == address(0)) revert InvalidTokenAddress();
        if (amount == 0) revert InvalidAmount();
        if (claimCodeHash == bytes32(0)) revert InvalidClaimCode();

        // Validate expiry time is within allowed range
        if (expiry <= block.timestamp + MIN_EXPIRY_TIME ||
            expiry > block.timestamp + MAX_EXPIRY_TIME) {
            revert InvalidExpiryTime();
        }

        // Generate a unique transfer ID with additional randomness
        bytes32 transferId = keccak256(
            abi.encodePacked(
                msg.sender,
                tokenAddress,
                amount,
                expiry,
                claimCodeHash,
                block.timestamp,
                blockhash(block.number - 1), // Add block hash for more randomness
                address(this)                // Add contract address for uniqueness
            )
        );

        // Ensure transfer ID doesn't already exist
        if (transfers[transferId].createdAt != 0) revert TransferAlreadyExists();

        // Calculate fee if applicable
        uint256 fee = 0;
        uint256 transferAmount = amount;

        if (feeInBasisPoints > 0) {
            fee = (amount * feeInBasisPoints) / 10000;
            transferAmount = amount - fee;
        }

        // Create the transfer record - note this is a link transfer with a password
        transfers[transferId] = Transfer({
            sender: msg.sender,
            recipient: address(0),          // No specific recipient for link transfers
            tokenAddress: tokenAddress,
            amount: transferAmount,         // Store the net amount after fee
            grossAmount: amount,            // Store the original amount before fee
            expiry: expiry,
            claimCodeHash: claimCodeHash,   // Store the claim code hash
            status: TransferStatus.Pending,
            createdAt: block.timestamp,
            isLinkTransfer: true            // Mark as link transfer
        });

        // Transfer tokens from sender to this contract
        IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), amount);

        // Transfer fee to fee collector if applicable
        if (fee > 0) {
            IERC20(tokenAddress).safeTransfer(feeCollector, fee);
        }

        emit TransferCreated(
            transferId,
            msg.sender,
            address(0),                     // No specific recipient
            tokenAddress,
            transferAmount,
            amount,
            expiry
        );

        return transferId;
    }

    /**
     * @notice Claims a transfer using the claim code
     * @param transferId The ID of the transfer to claim
     * @param claimCode The plain text claim code (not needed for link transfers)
     */
    function claimTransfer(bytes32 transferId, string calldata claimCode)
        external
        nonReentrant
    {
        Transfer storage transfer = transfers[transferId];

        // Validate transfer with custom errors
        if (transfer.createdAt == 0) revert TransferDoesNotExist();
        if (transfer.status != TransferStatus.Pending) revert TransferNotClaimable();
        if (block.timestamp > transfer.expiry) revert TransferExpired();

        // For transfers with a claim code, verify the code
        if (transfer.claimCodeHash != bytes32(0)) {
            bytes32 providedCodeHash = keccak256(abi.encodePacked(claimCode));
            if (providedCodeHash != transfer.claimCodeHash) revert InvalidClaimCode();
        }

        // If recipient is specified, only they can claim
        if (transfer.recipient != address(0) && msg.sender != transfer.recipient) {
            revert NotIntendedRecipient();
        }

        // Update transfer status first to prevent reentrancy
        transfer.status = TransferStatus.Claimed;

        // Transfer tokens to claimer
        IERC20(transfer.tokenAddress).safeTransfer(msg.sender, transfer.amount);

        emit TransferClaimed(transferId, msg.sender, transfer.amount);
    }

    /**
     * @notice Claims a link transfer using just the transfer ID
     * @param transferId The ID of the link transfer to claim
     */
    function claimLinkTransfer(bytes32 transferId)
        external
        nonReentrant
    {
        Transfer storage transfer = transfers[transferId];

        // Validate transfer with custom errors
        if (transfer.createdAt == 0) revert TransferDoesNotExist();
        if (transfer.status != TransferStatus.Pending) revert TransferNotClaimable();
        if (block.timestamp > transfer.expiry) revert TransferExpired();

        // Ensure this is a link transfer without password protection
        if (!transfer.isLinkTransfer) revert NotLinkTransfer();
        if (transfer.claimCodeHash != bytes32(0)) revert PasswordProtected();

        // Update transfer status first to prevent reentrancy
        transfer.status = TransferStatus.Claimed;

        // Transfer tokens to claimer
        IERC20(transfer.tokenAddress).safeTransfer(msg.sender, transfer.amount);

        emit TransferClaimed(transferId, msg.sender, transfer.amount);
    }

    /**
     * @notice Refunds an expired transfer back to the sender
     * @param transferId The ID of the transfer to refund
     */
    function refundTransfer(bytes32 transferId) external nonReentrant {
        Transfer storage transfer = transfers[transferId];

        // Validate transfer with custom errors
        if (transfer.createdAt == 0) revert TransferDoesNotExist();
        if (transfer.status != TransferStatus.Pending) revert TransferNotRefundable();
        if (block.timestamp <= transfer.expiry) revert TransferNotExpired();
        if (msg.sender != transfer.sender) revert NotTransferSender();

        // Update transfer status first to prevent reentrancy
        transfer.status = TransferStatus.Refunded;

        // Transfer tokens back to sender
        IERC20(transfer.tokenAddress).safeTransfer(transfer.sender, transfer.amount);

        emit TransferRefunded(transferId, transfer.sender, transfer.amount);
    }

    /**
     * @notice Gets the details of a transfer
     * @param transferId The ID of the transfer
     * @return sender The address that created the transfer
     * @return recipient The intended recipient (if specified)
     * @return tokenAddress The ERC20 token address
     * @return amount The net amount of tokens (after fee)
     * @return grossAmount The original amount before fee deduction
     * @return expiry The expiry timestamp
     * @return status The current status of the transfer
     * @return createdAt The timestamp when the transfer was created
     * @return isLinkTransfer Whether this is a link transfer
     */
    function getTransfer(bytes32 transferId)
        external
        view
        returns (
            address sender,
            address recipient,
            address tokenAddress,
            uint256 amount,
            uint256 grossAmount,
            uint256 expiry,
            TransferStatus status,
            uint256 createdAt,
            bool isLinkTransfer
        )
    {
        Transfer storage transfer = transfers[transferId];
        if (transfer.createdAt == 0) revert TransferDoesNotExist();

        return (
            transfer.sender,
            transfer.recipient,
            transfer.tokenAddress,
            transfer.amount,
            transfer.grossAmount,
            transfer.expiry,
            transfer.status,
            transfer.createdAt,
            transfer.isLinkTransfer
        );
    }

    /**
     * @notice Checks if a transfer exists and is claimable
     * @param transferId The ID of the transfer to check
     * @return isClaimable True if the transfer is claimable
     */
    function isTransferClaimable(bytes32 transferId) external view returns (bool) {
        Transfer storage transfer = transfers[transferId];
        return (
            transfer.createdAt > 0 &&
            transfer.status == TransferStatus.Pending &&
            block.timestamp <= transfer.expiry
        );
    }

    /**
     * @notice Checks if a transfer requires a password to claim
     * @param transferId The ID of the transfer to check
     * @return isPasswordProtected True if the transfer requires a password
     */
    function isPasswordProtected(bytes32 transferId) external view returns (bool) {
        Transfer storage transfer = transfers[transferId];
        if (transfer.createdAt == 0) revert TransferDoesNotExist();

        // A transfer requires a password if it has a non-zero claim code hash
        return transfer.claimCodeHash != bytes32(0);
    }

    /**
     * @notice Adds or removes a token from the supported tokens whitelist
     * @param tokenAddress The token address to update
     * @param isSupported Whether the token should be supported
     */
    function setTokenSupport(address tokenAddress, bool isSupported) external onlyOwner {
        if (tokenAddress == address(0)) revert InvalidTokenAddress();
        supportedTokens[tokenAddress] = isSupported;
        emit TokenWhitelistUpdated(tokenAddress, isSupported);
    }

    /**
     * @notice Updates the fee percentage
     * @param newFeeInBasisPoints The new fee in basis points
     */
    function setFee(uint16 newFeeInBasisPoints) external onlyOwner {
        if (newFeeInBasisPoints > MAX_FEE) revert FeeExceedsMaximum();
        uint16 oldFee = feeInBasisPoints;
        feeInBasisPoints = newFeeInBasisPoints;
        emit FeeUpdated(oldFee, newFeeInBasisPoints);
    }

    /**
     * @notice Updates the fee collector address
     * @param newFeeCollector The new fee collector address
     */
    function setFeeCollector(address newFeeCollector) external onlyOwner {
        if (newFeeCollector == address(0)) revert InvalidFeeCollector();
        address oldCollector = feeCollector;
        feeCollector = newFeeCollector;
        emit FeeCollectorUpdated(oldCollector, newFeeCollector);
    }

    /**
     * @notice Generates a unique transfer ID
     * @dev Internal function to avoid code duplication
     * @return transferId The generated transfer ID
     */
    function _generateTransferId(
        address sender,
        address recipient,
        address tokenAddress,
        uint256 amount,
        uint256 expiry,
        bytes32 claimCodeHash
    ) internal view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                sender,
                recipient,
                tokenAddress,
                amount,
                expiry,
                claimCodeHash,
                block.timestamp
            )
        );
    }
}
