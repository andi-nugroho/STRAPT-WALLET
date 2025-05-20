// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title USDC Mock Token
 * @notice Mock ERC20 token representing USD Coin for testing purposes
 * @dev Implements a simple ERC20 token with minting capabilities for testing
 */
contract USDCMock is ERC20, ERC20Burnable, Ownable {
    uint8 private _decimals;

    /**
     * @notice Constructs the USDC mock token contract
     * @param initialOwner The address that will own the contract and can mint tokens
     */
    constructor(address initialOwner) 
        ERC20("USD Coin", "USDC") 
        Ownable(initialOwner) 
    {
        _decimals = 6; // USDC uses 6 decimals
    }

    /**
     * @notice Returns the number of decimals used for token
     * @return The number of decimals
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @notice Mints new tokens
     * @param to The address that will receive the minted tokens
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
