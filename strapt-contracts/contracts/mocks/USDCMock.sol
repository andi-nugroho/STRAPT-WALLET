// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title USDCMock
 * @dev Mock USDC token for testing purposes
 */
contract USDCMock is ERC20, Ownable {
    uint8 private _decimals = 6; // USDC has 6 decimals

    /**
     * @dev Constructor that gives the specified address an initial supply of tokens
     * @param initialOwner The address that will be the owner of the contract
     */
    constructor(address initialOwner) 
        ERC20("IDRX Coin", "IDRX") 
        Ownable(initialOwner)
    {}

    /**
     * @dev Returns the number of decimals used to get its user representation.
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     */
    function mint(address account, uint256 amount) public onlyOwner {
        _mint(account, amount);
    }
}
