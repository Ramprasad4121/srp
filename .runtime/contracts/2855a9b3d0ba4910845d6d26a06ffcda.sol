// --- src/Trust.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

import { AccessControlUpgradeable } from "@openzeppelinV4/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import { ITrust } from "src/interfaces/ITrust.sol";
import { TrustToken } from "src/legacy/TrustToken.sol";

/**
 * @title  Trust
 * @author 0xIntuition
 * @notice The Intuition TRUST token.
 */
contract Trust is ITrust, TrustToken, AccessControlUpgradeable {
    /* =================================================== */
    /*                       V2 STATE                      */
    /* =================================================== */

    /// @notice BaseEmissionsController contract address
    address public baseEmissionsController;

    /// @dev Gap for upgrade safety
    uint256[50] private __gap;

    /* =================================================== */
    /*                       MODIFIERS                     */
    /* =================================================== */

    /// @notice Modifier to restrict access to only the BaseEmissionsController
    modifier onlyBaseEmissionsController() {
        if (msg.sender != baseEmissionsController) {
            revert Trust_OnlyBaseEmissionsController();
        }
        _;
    }

    /* =================================================== */
    /*                       CONSTRUCTOR                   */
    /* =================================================== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /* =================================================== */
    /*                      REINITIALIZER                  */
    /* =================================================== */

    /**
     * @notice Reinitializes the Trust contract with AccessControl
     * @param _admin Admin address (multisig)
     * @param _baseEmissionsController BaseEmissionsController address
     */
    function reinitialize(address _admin, address _baseEmissionsController) external reinitializer(2) {
        if (_admin == address(0) || _baseEmissionsController == address(0)) {
            revert Trust_ZeroAddress();
        }

        // Initialize AccessControl
        __AccessControl_init();

        // Set up roles
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);

        // Set the BaseEmissionsController address
        _setBaseEmissionsController(_baseEmissionsController);
    }

    /* =================================================== */
    /*                    VIEW FUNCTIONS                   */
    /* =================================================== */

    /**
     * @notice Returns the name of the token
     * @dev Overrides the `name` function from ERC20Upgradeable
     * @return Name of the token
     */
    function name() public view virtual override returns (string memory) {
        return "Intuition";
    }

    /* =================================================== */
    /*                    MINTER FUNCTIONS                 */
    /* =================================================== */

    /// @inheritdoc ITrust
    function mint(address to, uint256 amount) public override(ITrust, TrustToken) onlyBaseEmissionsController {
        _mint(to, amount);
    }

    /// @inheritdoc ITrust
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    /* =================================================== */
    /*                    ADMIN FUNCTIONS                  */
    /* =================================================== */

    /// @inheritdoc ITrust
    function setBaseEmissionsController(address newBaseEmissionsController) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setBaseEmissionsController(newBaseEmissionsController);
    }

    /* =================================================== */
    /*                    INTERNAL FUNCTIONS               */
    /* =================================================== */

    function _setBaseEmissionsController(address newBaseEmissionsController) internal {
        if (newBaseEmissionsController == address(0)) {
            revert Trust_ZeroAddress();
        }

        baseEmissionsController = newBaseEmissionsController;

        emit BaseEmissionsControllerSet(newBaseEmissionsController);
    }
}


// --- src/WrappedTrust.sol ---
// Copyright (C) 2015, 2016, 2017 Dapphub

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import { Address } from "@openzeppelin/contracts/utils/Address.sol";

pragma solidity 0.8.29;

contract WrappedTrust {
    string public name = "Wrapped TRUST";
    string public symbol = "WTRUST";
    uint8 public decimals = 18;

    event Approval(address indexed owner, address indexed spender, uint256 amount);
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Deposit(address indexed account, uint256 amount);
    event Withdrawal(address indexed account, uint256 amount);

    mapping(address account => uint256) public balanceOf;
    mapping(address account => mapping(address spender => uint256)) public allowance;

    receive() external payable {
        deposit();
    }

    function deposit() public payable {
        balanceOf[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) public {
        require(balanceOf[msg.sender] >= amount);
        balanceOf[msg.sender] -= amount;
        emit Withdrawal(msg.sender, amount);
        Address.sendValue(payable(msg.sender), amount);
    }

    function totalSupply() public view returns (uint256) {
        return address(this).balance;
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        return transferFrom(msg.sender, to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        require(balanceOf[from] >= amount);

        if (from != msg.sender && allowance[from][msg.sender] != type(uint256).max) {
            require(allowance[from][msg.sender] >= amount);
            allowance[from][msg.sender] -= amount;
        }

        balanceOf[from] -= amount;
        balanceOf[to] += amount;

        emit Transfer(from, to, amount);

        return true;
    }
}


// --- src/legacy/TrustToken.sol ---
// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import { ERC20Upgradeable } from "@openzeppelinV4/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { Initializable } from "@openzeppelinV4/contracts-upgradeable/proxy/utils/Initializable.sol";

contract TrustToken is Initializable, ERC20Upgradeable {
    error NotAllowedToMint();
    error ExceedsMinterCap();
    error ExceedsTotalSupply();

    uint256 public constant MAX_SUPPLY = 1e9 * 1e18; // 1 billion tokens, assuming 18 decimal places
    address public constant MINTER_A = 0xBc01aB3839bE8933f6B93163d129a823684f4CDF;
    address public constant MINTER_B = 0xA4Df56842887cF52C9ad59C97Ec0C058e96Af533;
    uint256 public totalMinted;

    mapping(address => uint256) public minterAmountMinted;

    function init() public initializer {
        __ERC20_init("TRUST", "TRUST");
    }

    function mint(address to, uint256 amount) public virtual {
        require(msg.sender == MINTER_A || msg.sender == MINTER_B, "Not authorized to mint");
        uint256 minterCap = (msg.sender == MINTER_A) ? (MAX_SUPPLY * 49 / 100) : (MAX_SUPPLY * 51 / 100);
        require(totalMinted + amount <= MAX_SUPPLY, "Max supply exceeded");
        require(minterAmountMinted[msg.sender] + amount <= minterCap, "Minting cap exceeded for minter");
        totalMinted += amount;
        minterAmountMinted[msg.sender] += amount;
        _mint(to, amount);
    }
}


// --- src/libraries/ProgressiveCurveMathLib.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

import { UD60x18, wrap, unwrap, uUNIT, mul } from "@prb/math/src/UD60x18.sol";
import { FixedPointMathLib } from "solady/utils/FixedPointMathLib.sol";

/**
 * @title  ProgressiveCurveMathLib
 * @author 0xIntuition
 * @notice A library for performing precise arithmetic operations on UD60x18 numbers,
 *         specifically tailored for progressive curve calculations.
 */
library ProgressiveCurveMathLib {
    /// @dev Multiplies two UD60x18 numbers, rounding up.
    function mulUp(UD60x18 x, UD60x18 y) internal pure returns (UD60x18) {
        return wrap(FixedPointMathLib.fullMulDivUp(unwrap(x), unwrap(y), uUNIT));
    }

    /// @dev Divides two UD60x18 numbers, rounding up.
    function divUp(UD60x18 x, UD60x18 y) internal pure returns (UD60x18) {
        return wrap(FixedPointMathLib.fullMulDivUp(unwrap(x), uUNIT, unwrap(y)));
    }

    /// @dev Squares a UD60x18 number, rounding down.
    function square(UD60x18 x) internal pure returns (UD60x18) {
        return mul(x, x);
    }

    /// @dev Squares a UD60x18 number, rounding up.
    function squareUp(UD60x18 x) internal pure returns (UD60x18) {
        return mulUp(x, x);
    }
}


// --- src/protocol/MultiVaultCore.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import { IMultiVault, VaultType } from "src/interfaces/IMultiVault.sol";
import {
    IMultiVaultCore,
    GeneralConfig,
    AtomConfig,
    TripleConfig,
    WalletConfig,
    VaultFees,
    BondingCurveConfig
} from "src/interfaces/IMultiVaultCore.sol";

/**
 * @title  MultiVaultCore
 * @author 0xIntuition
 * @notice Core contract of the Intuition protocol. Manages atom state, triple state, and protocol configuration.
 */
abstract contract MultiVaultCore is IMultiVaultCore, Initializable {
    /* =================================================== */
    /*                       CONSTANTS                     */
    /* =================================================== */

    /// @notice Salt for atoms
    bytes32 public constant ATOM_SALT = keccak256("ATOM_SALT");

    /// @notice Salt used for positive triples
    bytes32 public constant TRIPLE_SALT = keccak256("TRIPLE_SALT");

    /// @notice Salt used for counter triples
    bytes32 public constant COUNTER_SALT = keccak256("COUNTER_SALT");

    /* =================================================== */
    /*                  STATE VARIABLES                    */
    /* =================================================== */

    /// @notice Total number of terms created
    uint256 public totalTermsCreated;

    /// @notice Configuration structs
    GeneralConfig public generalConfig;
    AtomConfig public atomConfig;
    TripleConfig public tripleConfig;
    WalletConfig public walletConfig;
    VaultFees public vaultFees;
    BondingCurveConfig public bondingCurveConfig;

    /*//////////////////////////////////////////////////////////////
                                Mappings
    //////////////////////////////////////////////////////////////*/

    /// @notice Mapping of atom id to atom data
    mapping(bytes32 atomId => bytes data) internal _atoms;

    /// @notice Mapping of triple id to the underlying atom ids
    mapping(bytes32 tripleId => bytes32[3] tripleAtomIds) internal _triples;

    /// @notice Mapping of term IDs to determine whether a term is a triple or not
    mapping(bytes32 termId => bool isTriple) internal _isTriple;

    /// @notice Mapping of counter triple IDs to the corresponding triple IDs
    mapping(bytes32 counterTripleId => bytes32 tripleId) internal _tripleIdFromCounterId;

    /*//////////////////////////////////////////////////////////////
                                Errors
    //////////////////////////////////////////////////////////////*/

    error MultiVaultCore_InvalidAdmin();

    error MultiVaultCore_AtomDoesNotExist(bytes32 termId);

    error MultiVaultCore_TripleDoesNotExist(bytes32 termId);

    error MultiVaultCore_TermDoesNotExist(bytes32 termId);

    /* =================================================== */
    /*                    INITIALIZER                      */
    /* =================================================== */

    /**
     * @notice Initializes the MultiVaultCore contract with the provided configuration structs
     * @param _generalConfig General configuration for the protocol
     * @param _atomConfig Configuration for atom creation and management
     * @param _tripleConfig Configuration for triple creation and management
     * @param _walletConfig Configuration for wallet management
     * @param _vaultFees Fees associated with vault operations
     * @param _bondingCurveConfig Configuration for bonding curves used in the protocol
     */
    function __MultiVaultCore_init(
        GeneralConfig memory _generalConfig,
        AtomConfig memory _atomConfig,
        TripleConfig memory _tripleConfig,
        WalletConfig memory _walletConfig,
        VaultFees memory _vaultFees,
        BondingCurveConfig memory _bondingCurveConfig
    )
        internal
        onlyInitializing
    {
        _setGeneralConfig(_generalConfig);
        atomConfig = _atomConfig;
        tripleConfig = _tripleConfig;
        walletConfig = _walletConfig;
        vaultFees = _vaultFees;
        bondingCurveConfig = _bondingCurveConfig;
    }

    /* =================================================== */
    /*                 PROTOCOL GETTERS                    */
    /* =================================================== */

    /// @inheritdoc IMultiVaultCore
    function getGeneralConfig() external view returns (GeneralConfig memory) {
        return generalConfig;
    }

    /// @inheritdoc IMultiVaultCore
    function getAtomConfig() external view returns (AtomConfig memory) {
        return atomConfig;
    }

    /// @inheritdoc IMultiVaultCore
    function getTripleConfig() external view returns (TripleConfig memory) {
        return tripleConfig;
    }

    /// @inheritdoc IMultiVaultCore
    function getWalletConfig() external view returns (WalletConfig memory) {
        return walletConfig;
    }

    /// @inheritdoc IMultiVaultCore
    function getVaultFees() external view returns (VaultFees memory) {
        return vaultFees;
    }

    /// @inheritdoc IMultiVaultCore
    function getBondingCurveConfig() external view returns (BondingCurveConfig memory) {
        return bondingCurveConfig;
    }

    /* =================================================== */
    /*                      ATOM GETTERS                   */
    /* =================================================== */

    /// @inheritdoc IMultiVaultCore
    function atom(bytes32 atomId) external view returns (bytes memory data) {
        return _atoms[atomId];
    }

    /// @inheritdoc IMultiVaultCore
    function getAtom(bytes32 atomId) external view returns (bytes memory data) {
        return _getAtom(atomId);
    }

    /// @inheritdoc IMultiVaultCore
    function calculateAtomId(bytes memory data) external pure returns (bytes32 id) {
        return _calculateAtomId(data);
    }

    /// @inheritdoc IMultiVaultCore
    function getAtomCost() external view returns (uint256) {
        return _getAtomCost();
    }

    /// @inheritdoc IMultiVaultCore
    function isAtom(bytes32 atomId) external view returns (bool) {
        return _isAtom(atomId);
    }

    /* =================================================== */
    /*                    TRIPLE GETTERS                   */
    /* =================================================== */

    /// @inheritdoc IMultiVaultCore
    function triple(bytes32 tripleId) external view returns (bytes32, bytes32, bytes32) {
        bytes32[3] memory atomIds = _triples[tripleId];
        return (atomIds[0], atomIds[1], atomIds[2]);
    }

    /// @inheritdoc IMultiVaultCore
    function getTriple(bytes32 tripleId) external view returns (bytes32, bytes32, bytes32) {
        bytes32[3] memory atomIds = _triples[tripleId];
        if (atomIds[0] == bytes32(0) && atomIds[1] == bytes32(0) && atomIds[2] == bytes32(0)) {
            revert MultiVaultCore_TripleDoesNotExist(tripleId);
        }
        return (atomIds[0], atomIds[1], atomIds[2]);
    }

    /// @inheritdoc IMultiVaultCore
    function getTripleCost() external view returns (uint256) {
        return _getTripleCost();
    }

    /// @inheritdoc IMultiVaultCore
    function getCounterIdFromTripleId(bytes32 tripleId) external pure returns (bytes32) {
        return _calculateCounterTripleId(tripleId);
    }

    /// @inheritdoc IMultiVaultCore
    function getTripleIdFromCounterId(bytes32 counterId) external view returns (bytes32) {
        return _tripleIdFromCounterId[counterId];
    }

    /// @inheritdoc IMultiVaultCore
    function calculateTripleId(
        bytes32 subjectId,
        bytes32 predicateId,
        bytes32 objectId
    )
        external
        pure
        returns (bytes32)
    {
        return _calculateTripleId(subjectId, predicateId, objectId);
    }

    /// @inheritdoc IMultiVaultCore
    function calculateCounterTripleId(
        bytes32 subjectId,
        bytes32 predicateId,
        bytes32 objectId
    )
        external
        pure
        returns (bytes32)
    {
        bytes32 tripleId = _calculateTripleId(subjectId, predicateId, objectId);
        return _calculateCounterTripleId(tripleId);
    }

    /// @inheritdoc IMultiVaultCore
    function isTriple(bytes32 termId) external view returns (bool) {
        return _isTriple[termId];
    }

    /// @inheritdoc IMultiVaultCore
    function isCounterTriple(bytes32 termId) external view returns (bool) {
        return _isCounterTriple(termId);
    }

    /// @inheritdoc IMultiVaultCore
    function getInverseTripleId(bytes32 tripleId) external view returns (bytes32) {
        return _getInverseTripleId(tripleId);
    }

    /// @inheritdoc IMultiVaultCore
    function getVaultType(bytes32 termId) external view returns (VaultType) {
        return _getVaultType(termId);
    }

    /* =================================================== */
    /*                 INTERNAL FUNCTIONS                  */
    /* =================================================== */

    /// @dev Internal function to set and validate the general configuration struct
    function _setGeneralConfig(GeneralConfig memory _generalConfig) internal {
        if (_generalConfig.admin == address(0)) revert MultiVaultCore_InvalidAdmin();
        generalConfig = _generalConfig;
    }

    /// @dev Internal function to check if an atom exists
    /// @param atomId atom id to check
    function _isAtom(bytes32 atomId) internal view returns (bool) {
        return _atoms[atomId].length != 0;
    }

    /// @dev Internal function to calculate the atom id from the atom data
    /// @param data The data of the atom
    function _calculateAtomId(bytes memory data) internal pure returns (bytes32 id) {
        return keccak256(abi.encodePacked(ATOM_SALT, keccak256(data)));
    }

    /// @dev Internal function to calculate the triple id from the subject, predicate, and object atom ids
    /// @param subjectId The atom id of the subject
    /// @param predicateId The atom id of the predicate
    /// @param objectId The atom id of the object
    /// @return id The calculated triple id
    function _calculateTripleId(
        bytes32 subjectId,
        bytes32 predicateId,
        bytes32 objectId
    )
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(TRIPLE_SALT, subjectId, predicateId, objectId));
    }

    /// @dev Internal function to calculate the counter triple id from the triple id
    /// @param tripleId The id of the triple
    /// @return id The calculated counter triple id
    function _calculateCounterTripleId(bytes32 tripleId) internal pure returns (bytes32) {
        return bytes32(keccak256(abi.encodePacked(COUNTER_SALT, tripleId)));
    }

    /// @dev Internal function to get the triple id from the given counter id
    /// @param termId term id of the counter triple
    /// @return tripleId the triple vault id from the given counter id
    function _isCounterTriple(bytes32 termId) internal view returns (bool) {
        return _tripleIdFromCounterId[termId] != bytes32(0);
    }

    /// @dev Internal function to get the atom data for a given atom id
    /// @dev If the atom does not exist, this function reverts
    /// @param atomId The id of the atom
    /// @return data The data of the atom
    function _getAtom(bytes32 atomId) internal view returns (bytes memory data) {
        bytes memory _data = _atoms[atomId];
        if (_data.length == 0) {
            revert MultiVaultCore_AtomDoesNotExist(atomId);
        }
        return _data;
    }

    /// @dev Internal function to get the underlying atom ids for a given triple id
    /// @dev If the triple does not exist, this function reverts
    /// @param tripleId term id of the triple
    /// @return The underlying atom ids of the triple
    function _getTriple(bytes32 tripleId) internal view returns (bytes32, bytes32, bytes32) {
        bytes32[3] memory atomIds = _triples[tripleId];
        if (atomIds[0] == bytes32(0) && atomIds[1] == bytes32(0) && atomIds[2] == bytes32(0)) {
            revert MultiVaultCore_TripleDoesNotExist(tripleId);
        }
        return (atomIds[0], atomIds[1], atomIds[2]);
    }

    /// @dev Internal function to get the inverse triple id (counter or positive) for a given triple id
    /// @param tripleId The id of the triple or counter triple
    /// @return The inverse triple id
    function _getInverseTripleId(bytes32 tripleId) internal view returns (bytes32) {
        if (_isCounterTriple(tripleId)) {
            return _tripleIdFromCounterId[tripleId];
        } else {
            return _calculateCounterTripleId(tripleId);
        }
    }

    /// @dev Internal function to determine the vault type for a given term ID
    function _getVaultType(bytes32 termId) internal view returns (VaultType) {
        bool _isVaultAtom = _isAtom(termId);
        bool _isVaultTriple = _isTriple[termId];
        bool _isVaultCounterTriple = _isCounterTriple(termId);

        if (!_isVaultAtom && !_isVaultTriple && !_isVaultCounterTriple) {
            revert MultiVaultCore_TermDoesNotExist(termId);
        }

        if (_isVaultAtom) return VaultType.ATOM;
        if (_isVaultCounterTriple) return VaultType.COUNTER_TRIPLE;
        return VaultType.TRIPLE;
    }

    /// @dev Internal function to get the static costs that go into creating an atom
    /// @return atomCost the static costs of creating an atom
    function _getAtomCost() internal view returns (uint256) {
        return atomConfig.atomCreationProtocolFee + generalConfig.minShare;
    }

    /// @dev Internal function to get the static costs that go into creating a triple
    /// @return tripleCost the static costs of creating a triple
    function _getTripleCost() internal view returns (uint256) {
        return tripleConfig.tripleCreationProtocolFee + generalConfig.minShare * 2;
    }
}


// --- src/protocol/MultiVault.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { FixedPointMathLib } from "solady/utils/FixedPointMathLib.sol";

import { IMultiVault, ApprovalTypes, VaultState, VaultType } from "src/interfaces/IMultiVault.sol";
import { IAtomWalletFactory } from "src/interfaces/IAtomWalletFactory.sol";
import { IBondingCurveRegistry } from "src/interfaces/IBondingCurveRegistry.sol";
import { IAtomWallet } from "src/interfaces/IAtomWallet.sol";
import { ITrustBonding } from "src/interfaces/ITrustBonding.sol";
import {
    GeneralConfig,
    AtomConfig,
    TripleConfig,
    WalletConfig,
    VaultFees,
    BondingCurveConfig
} from "src/interfaces/IMultiVaultCore.sol";

import { MultiVaultCore } from "src/protocol/MultiVaultCore.sol";

/**
 * @title  MultiVault
 * @author 0xIntuition
 * @notice Core contract of the Intuition protocol. Manages the creation and management of vaults
 *         associated with atoms & triples using TRUST as the base asset.
 */
contract MultiVault is
    IMultiVault,
    MultiVaultCore,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using FixedPointMathLib for uint256;

    /* =================================================== */
    /*                       CONSTANTS                     */
    /* =================================================== */

    /// @notice Maximum number of actions allowed in a single batch
    uint256 public constant MAX_BATCH_SIZE = 150;

    /// @notice Constant representing the burn address, which receives the "ghost (min) shares"
    address public constant BURN_ADDRESS = address(0x000000000000000000000000000000000000dEaD);

    /* =================================================== */
    /*                  INTERNAL STATE                     */
    /* =================================================== */

    /// @notice Mapping of the receiver's approved status for a given sender
    // Receiver -> Sender -> Approval Type (0 = none, 1 = deposit approval, 2 = redemption approval, 3 = both)
    mapping(address receiver => mapping(address sender => uint8 approvalType)) internal approvals;

    /// @notice Mapping of term ID to bonding curve ID to vault state
    // Term ID (atom or triple ID) -> Bonding Curve ID -> Vault State
    mapping(bytes32 termId => mapping(uint256 curveId => VaultState vaultState)) internal _vaults;

    /// @notice Mapping of the accumulated protocol fees for each epoch
    // Epoch -> Accumulated protocol fees
    mapping(uint256 epoch => uint256 accumulatedFees) public accumulatedProtocolFees;

    /// @notice Mapping of the atom wallet address to the accumulated fees for that wallet
    // Atom wallet address -> Accumulated fees
    mapping(address atomWallet => uint256 accumulatedFees) public accumulatedAtomWalletDepositFees;

    /// @notice Mapping of the TRUST token amount utilization for each epoch
    // Epoch -> TRUST token amount used by all users, defined as the difference between the amount of TRUST
    // deposited and redeemed by actions of all users
    mapping(uint256 epoch => int256 utilizationAmount) public totalUtilization;

    /// @notice Mapping of the TRUST token amount utilization for each user in each epoch
    // User address -> Epoch -> TRUST token amount used by the user, defined as the difference between the amount of
    // TRUST
    // deposited and redeemed by the user
    mapping(address user => mapping(uint256 epoch => int256 utilizationAmount)) public personalUtilization;

    /// @notice Mapping of the last 3 active epochs for each user
    mapping(address user => uint256[3] epoch) public userEpochHistory;

    /* =================================================== */
    /*                        Errors                       */
    /* =================================================== */

    error MultiVault_ArraysNotSameLength();

    error MultiVault_AtomExists(bytes atomData);

    error MultiVault_AtomDoesNotExist(bytes32 atomId);

    error MultiVault_AtomDataTooLong();

    error MultiVault_BurnFromZeroAddress();

    error MultiVault_BurnInsufficientBalance();

    error MultiVault_CannotApproveOrRevokeSelf();

    error MultiVault_DepositBelowMinimumDeposit();

    error MultiVault_DepositOrRedeemZeroShares();

    error MultiVault_HasCounterStake();

    error MultiVault_InvalidArrayLength();

    error MultiVault_InsufficientAssets();

    error MultiVault_InsufficientBalance();

    error MultiVault_InsufficientRemainingSharesInVault(uint256 remainingShares);

    error MultiVault_InsufficientSharesInVault();

    error MultiVault_NoAtomDataProvided();

    error MultiVault_OnlyAssociatedAtomWallet();

    error MultiVault_RedeemerNotApproved();

    error MultiVault_SenderNotApproved();

    error MultiVault_SlippageExceeded();

    error MultiVault_TripleExists(bytes32 termId, bytes32 subjectId, bytes32 predicateId, bytes32 objectId);

    error MultiVault_TermNotTriple();

    error MultiVault_ActionExceedsMaxAssets();

    error MultiVault_ActionExceedsMaxShares();

    error MultiVault_DefaultCurveMustBeInitializedViaCreatePaths();

    error MultiVault_DepositTooSmallToCoverMinShares();

    error MultiVault_CannotDirectlyInitializeCounterTriple();

    error MultiVault_TermDoesNotExist(bytes32 termId);

    error MultiVault_EpochNotTracked();

    error MultiVault_InvalidEpoch();

    /* =================================================== */
    /*                    CONSTRUCTOR                      */
    /* =================================================== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /* =================================================== */
    /*                    INITIALIZER                      */
    /* =================================================== */

    /// @notice Initializer function for the MultiVault contract
    /// @param _generalConfig General configuration parameters for the MultiVault
    /// @param _atomConfig Atom-specific configuration parameters
    /// @param _tripleConfig Triple-specific configuration parameters
    /// @param _walletConfig AtomWallet-specific configuration parameters
    /// @param _vaultFees Fee structure for the vault operations
    /// @param _bondingCurveConfig Configuration parameters for the bonding curves
    function initialize(
        GeneralConfig memory _generalConfig,
        AtomConfig memory _atomConfig,
        TripleConfig memory _tripleConfig,
        WalletConfig memory _walletConfig,
        VaultFees memory _vaultFees,
        BondingCurveConfig memory _bondingCurveConfig
    )
        external
        initializer
    {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __MultiVaultCore_init(
            _generalConfig, _atomConfig, _tripleConfig, _walletConfig, _vaultFees, _bondingCurveConfig
        );
        _grantRole(DEFAULT_ADMIN_ROLE, _generalConfig.admin);
    }

    /* =================================================== */
    /*                        VIEWS                        */
    /* =================================================== */

    /// @inheritdoc IMultiVault
    function isTermCreated(bytes32 id) external view returns (bool) {
        return _isTermCreated(id);
    }

    /// @inheritdoc IMultiVault
    function protocolFeeAmount(uint256 assets) external view returns (uint256) {
        return _feeOnRaw(assets, vaultFees.protocolFee);
    }

    /// @inheritdoc IMultiVault
    function entryFeeAmount(uint256 assets) external view returns (uint256) {
        return _feeOnRaw(assets, vaultFees.entryFee);
    }

    /// @inheritdoc IMultiVault
    function exitFeeAmount(uint256 assets) external view returns (uint256) {
        return _feeOnRaw(assets, vaultFees.exitFee);
    }

    /// @inheritdoc IMultiVault
    function atomDepositFractionAmount(uint256 assets) external view returns (uint256) {
        return _feeOnRaw(assets, tripleConfig.atomDepositFractionForTriple);
    }

    /// @inheritdoc IMultiVault
    function getTotalUtilizationForEpoch(uint256 epoch) external view returns (int256) {
        return totalUtilization[epoch];
    }

    /// @inheritdoc IMultiVault
    function getUserUtilizationForEpoch(address user, uint256 epoch) external view returns (int256) {
        return personalUtilization[user][epoch];
    }

    /// @inheritdoc IMultiVault
    function getUserLastActiveEpoch(address user) external view returns (uint256) {
        return userEpochHistory[user][0];
    }

    /// @inheritdoc IMultiVault
    function getUserUtilizationInEpoch(address user, uint256 epoch) external view returns (int256) {
        uint256 _currentEpoch = _currentEpoch();

        // Revert if calling with future epoch
        if (epoch > _currentEpoch) revert MultiVault_InvalidEpoch();

        uint256[3] memory _userEpochHistory = userEpochHistory[user];

        // Case A: check most recent activity
        if (_userEpochHistory[0] <= epoch) {
            return personalUtilization[user][_userEpochHistory[0]];
        }

        // Case B: check previous activity
        if (_userEpochHistory[1] <= epoch) {
            return personalUtilization[user][_userEpochHistory[1]];
        }

        // Case C: check previous-previous activity
        if (_userEpochHistory[2] <= epoch) {
            return personalUtilization[user][_userEpochHistory[2]];
        }

        // No tracked epoch strictly earlier than `epoch`
        revert MultiVault_EpochNotTracked();
    }

    /// @inheritdoc IMultiVault
    function getAtomWarden() external view returns (address) {
        return walletConfig.atomWarden;
    }

    /// @inheritdoc IMultiVault
    function getVault(bytes32 termId, uint256 curveId) external view returns (uint256, uint256) {
        VaultState storage vault = _vaults[termId][curveId];
        return (vault.totalAssets, vault.totalShares);
    }

    /// @inheritdoc IMultiVault
    function getShares(address account, bytes32 termId, uint256 curveId) public view returns (uint256) {
        return _vaults[termId][curveId].balanceOf[account];
    }

    /// @inheritdoc IMultiVault
    function computeAtomWalletAddr(bytes32 atomId) external view returns (address) {
        return _computeAtomWalletAddr(atomId);
    }

    /// @inheritdoc IMultiVault
    function maxRedeem(address sender, bytes32 termId, uint256 curveId) external view returns (uint256) {
        return _maxRedeem(sender, termId, curveId);
    }

    /// @inheritdoc IMultiVault
    function currentEpoch() external view returns (uint256) {
        return _currentEpoch();
    }

    /// @inheritdoc IMultiVault
    function currentSharePrice(bytes32 termId, uint256 curveId) external view returns (uint256) {
        VaultState storage vaultState = _vaults[termId][curveId];
        return IBondingCurveRegistry(bondingCurveConfig.registry)
            .currentPrice(curveId, vaultState.totalShares, vaultState.totalAssets);
    }

    /// @inheritdoc IMultiVault
    function previewAtomCreate(
        bytes32 termId,
        uint256 assets
    )
        external
        view
        returns (uint256 shares, uint256 assetsAfterFixedFees, uint256 assetsAfterFees)
    {
        return _calculateAtomCreate(termId, assets);
    }

    /// @inheritdoc IMultiVault
    function previewTripleCreate(
        bytes32 termId,
        uint256 assets
    )
        external
        view
        returns (uint256 shares, uint256 assetsAfterFixedFees, uint256 assetsAfterFees)
    {
        return _calculateTripleCreate(termId, assets);
    }

    /// @inheritdoc IMultiVault
    function previewDeposit(
        bytes32 termId,
        uint256 curveId,
        uint256 assets
    )
        public
        view
        returns (uint256 shares, uint256 assetsAfterFees)
    {
        if (!_isTermCreated(termId)) revert MultiVault_TermDoesNotExist(termId);
        bool isAtomVault = _isAtom(termId);
        (shares,, assetsAfterFees) = _calculateDeposit(termId, curveId, assets, isAtomVault);
    }

    /// @inheritdoc IMultiVault
    function previewRedeem(
        bytes32 termId,
        uint256 curveId,
        uint256 shares
    )
        public
        view
        returns (uint256 assetsAfterFees, uint256 sharesUsed)
    {
        if (!_isTermCreated(termId)) revert MultiVault_TermDoesNotExist(termId);
        return _calculateRedeem(termId, curveId, shares);
    }

    /// @inheritdoc IMultiVault
    function convertToShares(bytes32 termId, uint256 curveId, uint256 assets) external view returns (uint256) {
        if (!_isTermCreated(termId)) revert MultiVault_TermDoesNotExist(termId);
        return _convertToShares(termId, curveId, assets);
    }

    /// @inheritdoc IMultiVault
    function convertToAssets(bytes32 termId, uint256 curveId, uint256 shares) external view returns (uint256) {
        if (!_isTermCreated(termId)) revert MultiVault_TermDoesNotExist(termId);
        return _convertToAssets(termId, curveId, shares);
    }

    /* =================================================== */
    /*                      Approvals                      */
    /* =================================================== */

    /// @inheritdoc IMultiVault
    function approve(address sender, ApprovalTypes approvalType) external {
        address receiver = msg.sender;

        if (receiver == sender) {
            revert MultiVault_CannotApproveOrRevokeSelf();
        }

        if (approvalType == ApprovalTypes.NONE) {
            delete approvals[receiver][sender];
        } else {
            approvals[receiver][sender] = uint8(approvalType);
        }

        emit ApprovalTypeUpdated(sender, receiver, approvalType);
    }

    /* =================================================== */
    /*                      Atoms                          */
    /* =================================================== */

    /// @inheritdoc IMultiVault
    function createAtoms(
        bytes[] calldata data,
        uint256[] calldata assets
    )
        external
        payable
        whenNotPaused
        nonReentrant
        returns (bytes32[] memory)
    {
        uint256 _amount = _validatePayment(assets);
        return _createAtoms(data, assets, _amount);
    }

    /// @notice Internal utility function to handle the creation of multiple atom vaults
    /// @param _data The array of atom data to create atoms with
    /// @param _assets The total value sent with the transaction
    /// @param _payment The total value sent with the transaction
    /// @return ids The new term IDs created for the atoms
    function _createAtoms(
        bytes[] calldata _data,
        uint256[] calldata _assets,
        uint256 _payment
    )
        internal
        returns (bytes32[] memory)
    {
        uint256 length = _data.length;
        if (length == 0) {
            revert MultiVault_NoAtomDataProvided();
        }

        if (length != _assets.length) {
            revert MultiVault_ArraysNotSameLength();
        }

        bytes32[] memory ids = new bytes32[](length);

        for (uint256 i = 0; i < length;) {
            ids[i] = _createAtom(msg.sender, _data[i], _assets[i]);
            unchecked {
                ++i;
            }
        }

        // Add the static portion of the fee that is yet to be accounted for
        uint256 atomCreationProtocolFees = atomConfig.atomCreationProtocolFee * length;
        _accumulateStaticProtocolFees(atomCreationProtocolFees);

        _addUtilization(msg.sender, int256(_payment));

        return ids;
    }

    /// @notice Internal utility function to create an atom and handle vault creation
    /// @param data The atom data to create the atom with
    /// @param assets The value to deposit into the atom
    /// @param sender The address of the sender
    /// @return atomId The new vault ID created for the atom
    function _createAtom(address sender, bytes calldata data, uint256 assets) internal returns (bytes32 atomId) {
        uint256 length = data.length;

        if (length == 0) {
            revert MultiVault_NoAtomDataProvided();
        }

        // Check if atom data length is valid.
        if (length > generalConfig.atomDataMaxLength) {
            revert MultiVault_AtomDataTooLong();
        }

        // Check if atom already exists.
        atomId = _calculateAtomId(data);
        if (_atoms[atomId].length != 0) {
            revert MultiVault_AtomExists(data);
        }

        // Map atom ID to atom data
        _atoms[atomId] = data;
        uint256 curveId = bondingCurveConfig.defaultCurveId;

        /* --- Calculate final shares and assets after fees --- */
        (uint256 sharesForReceiver, uint256 assetsAfterFixedFees, uint256 assetsAfterFees) =
            _calculateAtomCreate(atomId, assets);

        /* --- Handle protocol fees --- */
        _accumulateVaultProtocolFees(assetsAfterFixedFees);
        address atomWallet = _accumulateAtomWalletFees(atomId, assetsAfterFixedFees);

        /* --- Add assets after fees to Atom Vault (User Owned) --- */
        uint256 userSharesAfter =
            _updateVaultOnCreation(sender, atomId, curveId, assetsAfterFees, sharesForReceiver, VaultType.ATOM);

        /* --- Emit Events --- */
        emit AtomCreated(sender, atomId, data, atomWallet);

        emit Deposited(
            sender, sender, atomId, curveId, assets, assetsAfterFees, sharesForReceiver, userSharesAfter, VaultType.ATOM
        );

        // Increment total terms created
        ++totalTermsCreated;

        return atomId;
    }

    /* =================================================== */
    /*                      Triples                        */
    /* =================================================== */

    /// @inheritdoc IMultiVault
    function createTriples(
        bytes32[] calldata subjectIds,
        bytes32[] calldata predicateIds,
        bytes32[] calldata objectIds,
        uint256[] calldata assets
    )
        external
        payable
        whenNotPaused
        nonReentrant
        returns (bytes32[] memory)
    {
        uint256 _amount = _validatePayment(assets);
        return _createTriples(subjectIds, predicateIds, objectIds, assets, _amount);
    }

    /// @notice Internal utility function to create triples and handle vault creation
    /// @param _subjectIds vault ids array of subject atoms
    /// @param _predicateIds vault ids array of predicate atoms
    /// @param _objectIds vault ids array of object atoms
    /// @param _assets The total value sent with the transaction
    /// @return ids The new vault IDs created for the triples
    function _createTriples(
        bytes32[] calldata _subjectIds,
        bytes32[] calldata _predicateIds,
        bytes32[] calldata _objectIds,
        uint256[] calldata _assets,
        uint256 _amount
    )
        internal
        returns (bytes32[] memory)
    {
        uint256 length = _subjectIds.length;
        uint256 minCost = _getTripleCost() * _assets.length;

        if (length == 0) {
            revert MultiVault_InvalidArrayLength();
        }

        if (_predicateIds.length != length || _objectIds.length != length || _assets.length != length) {
            revert MultiVault_ArraysNotSameLength();
        }

        if (_amount < minCost) {
            revert MultiVault_InsufficientBalance();
        }

        bytes32[] memory ids = new bytes32[](length);
        for (uint256 i = 0; i < length;) {
            ids[i] = _createTriple(msg.sender, _subjectIds[i], _predicateIds[i], _objectIds[i], _assets[i]);
            unchecked {
                ++i;
            }
        }

        // Add the static portion of the fee that is yet to be accounted for
        uint256 tripleCreationProtocolFees = tripleConfig.tripleCreationProtocolFee * length;
        _accumulateStaticProtocolFees(tripleCreationProtocolFees);

        /* --- Increase the users utilization ratio to calculate rewards --- */
        _addUtilization(msg.sender, int256(_amount));

        return ids;
    }

    /// @notice Internal utility function to create a triple and handle vault creation
    /// @param subjectId vault id of the subject atom
    /// @param predicateId vault id of the predicate atom
    /// @param objectId vault id of the object atom
    /// @param assets The value to deposit into the triple
    /// @param sender The address of the sender
    /// @return tripleId The new vault ID created for the triple
    function _createTriple(
        address sender,
        bytes32 subjectId,
        bytes32 predicateId,
        bytes32 objectId,
        uint256 assets
    )
        internal
        returns (bytes32 tripleId)
    {
        tripleId = _calculateTripleId(subjectId, predicateId, objectId);
        _tripleExists(tripleId, subjectId, predicateId, objectId);

        _requireTermExists(subjectId);
        _requireTermExists(predicateId);
        _requireTermExists(objectId);

        // Initialize the triple vault state.
        bytes32[3] memory _atomsArray = [subjectId, predicateId, objectId];
        bytes32 _counterTripleId = _calculateCounterTripleId(tripleId);

        // Set the triple mappings.
        _initializeTripleState(tripleId, _counterTripleId, _atomsArray);

        uint256 curveId = bondingCurveConfig.defaultCurveId;

        /* --- Calculate final shares and assets after fees --- */
        (uint256 sharesForReceiver, uint256 assetsAfterFixedFees, uint256 assetsAfterFees) =
            _calculateTripleCreate(tripleId, assets);

        /* --- Accumulate dynamic fees --- */
        _accumulateVaultProtocolFees(assetsAfterFixedFees);

        /* --- Add user assets after fees to vault (User Owned) --- */
        uint256 userSharesAfter =
            _updateVaultOnCreation(sender, tripleId, curveId, assetsAfterFees, sharesForReceiver, VaultType.TRIPLE);

        /* --- Add vault and triple fees to vault (Protocol Owned) --- */
        if (_shouldChargeAtomDepositFraction(tripleId)) {
            _increaseProRataVaultsAssets(
                tripleId, _feeOnRaw(assetsAfterFixedFees, tripleConfig.atomDepositFractionForTriple)
            );
        }

        /* --- Initialize the counter vault with min shares --- */
        _initializeCounterTripleVault(_counterTripleId, curveId);

        /* --- Emit events --- */
        emit TripleCreated(sender, tripleId, subjectId, predicateId, objectId);

        emit Deposited(
            sender,
            sender,
            tripleId,
            curveId,
            assets,
            assetsAfterFees,
            sharesForReceiver,
            userSharesAfter,
            VaultType.TRIPLE
        );

        // Increment total terms created by 2 (triple + counter triple)
        totalTermsCreated += 2;

        return tripleId;
    }

    /// @notice Internal utility function to initialize the counter triple vault with minimum shares
    /// @param tripleId The ID of the triple
    /// @param counterTripleId The ID of the counter triple
    /// @param _atomsArray The array of atom IDs that make up the triple
    function _initializeTripleState(bytes32 tripleId, bytes32 counterTripleId, bytes32[3] memory _atomsArray) internal {
        _triples[tripleId] = _atomsArray;
        _isTriple[tripleId] = true;

        // Set the counter triple mappings.
        _isTriple[counterTripleId] = true;
        _triples[counterTripleId] = _atomsArray;
        _tripleIdFromCounterId[counterTripleId] = tripleId;
    }

    /* =================================================== */
    /*                       Deposit                       */
    /* =================================================== */

    /// @inheritdoc IMultiVault
    function deposit(
        address receiver,
        bytes32 termId,
        uint256 curveId,
        uint256 minShares
    )
        external
        payable
        whenNotPaused
        nonReentrant
        returns (uint256)
    {
        if (!_isApprovedToDeposit(msg.sender, receiver)) {
            revert MultiVault_SenderNotApproved();
        }

        _addUtilization(receiver, int256(msg.value));

        return _processDeposit(msg.sender, receiver, termId, curveId, msg.value, minShares);
    }

    /// @inheritdoc IMultiVault
    function depositBatch(
        address receiver,
        bytes32[] calldata termIds,
        uint256[] calldata curveIds,
        uint256[] calldata assets,
        uint256[] calldata minShares
    )
        external
        payable
        whenNotPaused
        nonReentrant
        returns (uint256[] memory shares)
    {
        uint256 _assetsSum = _validatePayment(assets);
        uint256 length = termIds.length;

        if (length == 0 || length > MAX_BATCH_SIZE) {
            revert MultiVault_InvalidArrayLength();
        }

        shares = new uint256[](length);

        if (length != curveIds.length || length != assets.length || length != minShares.length) {
            revert MultiVault_ArraysNotSameLength();
        }

        if (!_isApprovedToDeposit(msg.sender, receiver)) {
            revert MultiVault_SenderNotApproved();
        }

        for (uint256 i = 0; i < length;) {
            shares[i] = _processDeposit(msg.sender, receiver, termIds[i], curveIds[i], assets[i], minShares[i]);
            unchecked {
                ++i;
            }
        }

        _addUtilization(receiver, int256(_assetsSum));

        return shares;
    }

    /// @notice Internal utility function to process a deposit
    /// @param sender The address of the sender
    /// @param receiver The address of the receiver
    /// @param termId The ID of the atom or triple
    /// @param curveId The ID of the bonding curve
    /// @param assets The amount of assets to deposit
    /// @param minShares The minimum amount of shares to receive
    /// @return sharesForReceiver The amount of shares minted for the receiver
    function _processDeposit(
        address sender,
        address receiver,
        bytes32 termId,
        uint256 curveId,
        uint256 assets,
        uint256 minShares
    )
        internal
        returns (uint256)
    {
        // --- validations independent of vault type ---
        _validateMinDeposit(assets);

        // --- discover vault type and basic flags up front ---
        VaultType _vaultType = _getVaultType(termId);
        bool isNew = _isNewVault(termId, curveId);
        bool isDefault = curveId == bondingCurveConfig.defaultCurveId;

        // --- triple-only invariants before any state changes ---
        if (_vaultType != VaultType.ATOM) {
            if (_hasCounterStake(termId, curveId, receiver)) revert MultiVault_HasCounterStake();
            if (isNew && _isCounterTriple(termId)) revert MultiVault_CannotDirectlyInitializeCounterTriple();
        }

        // default curve vaults must be created via createAtoms/createTriples
        if (isNew && isDefault) {
            revert MultiVault_DefaultCurveMustBeInitializedViaCreatePaths();
        }

        /* --- Calculate final shares and assets after fees --- */
        (uint256 sharesForReceiver, uint256 assetsAfterMinSharesCost, uint256 assetsAfterFees) =
            _calculateDeposit(termId, curveId, assets, _vaultType == VaultType.ATOM);

        /* --- Slippage check --- */
        _validateMinShares(
            termId, curveId, assets, sharesForReceiver, assetsAfterMinSharesCost, assetsAfterFees, minShares
        );

        /* --- Accumulate dynamic fees --- */
        _accumulateVaultProtocolFees(assetsAfterMinSharesCost);

        /* --- Add entry fee to vault (Protocol Owned) --- */
        if (_shouldChargeFees(termId)) {
            _increaseProRataVaultAssets(termId, _feeOnRaw(assetsAfterMinSharesCost, vaultFees.entryFee), _vaultType);
        }

        /* --- Apply atom or triple specific fees --- */
        if (_vaultType == VaultType.ATOM) {
            _accumulateAtomWalletFees(termId, assetsAfterMinSharesCost);
        } else {
            if (_shouldChargeAtomDepositFraction(termId)) {
                _increaseProRataVaultsAssets(
                    termId, _feeOnRaw(assetsAfterMinSharesCost, tripleConfig.atomDepositFractionForTriple)
                );
            }
        }

        uint256 userBalanceAfter;

        // --- user accounting (returns the user's total balance after mint) ---
        if (isNew && !isDefault) {
            userBalanceAfter =
                _updateVaultOnCreation(receiver, termId, curveId, assetsAfterFees, sharesForReceiver, _vaultType);

            if (_vaultType != VaultType.ATOM) {
                bytes32 _counterTripleId = _calculateCounterTripleId(termId);

                /* --- Initialize the counter vault with min shares --- */
                _initializeCounterTripleVault(_counterTripleId, curveId);
            }
        } else {
            userBalanceAfter =
                _updateVaultOnDeposit(receiver, termId, curveId, assetsAfterFees, sharesForReceiver, _vaultType);
        }

        emit Deposited(
            sender, receiver, termId, curveId, assets, assetsAfterFees, sharesForReceiver, userBalanceAfter, _vaultType
        );

        return sharesForReceiver;
    }

    /* =================================================== */
    /*                        Redeem                       */
    /* =================================================== */

    /// @inheritdoc IMultiVault
    function redeem(
        address receiver,
        bytes32 termId,
        uint256 curveId,
        uint256 shares,
        uint256 minAssets
    )
        external
        whenNotPaused
        nonReentrant
        returns (uint256)
    {
        if (!_isApprovedToRedeem(msg.sender, receiver)) {
            revert MultiVault_RedeemerNotApproved();
        }

        (uint256 rawAssetsBeforeFees, uint256 assetsAfterFees) =
            _processRedeem(msg.sender, receiver, termId, curveId, shares, minAssets);
        _removeUtilization(receiver, int256(rawAssetsBeforeFees));

        return assetsAfterFees;
    }

    /// @inheritdoc IMultiVault
    function redeemBatch(
        address receiver,
        bytes32[] calldata termIds,
        uint256[] calldata curveIds,
        uint256[] calldata shares,
        uint256[] calldata minAssets
    )
        external
        whenNotPaused
        nonReentrant
        returns (uint256[] memory received)
    {
        if (termIds.length == 0 || termIds.length > MAX_BATCH_SIZE) {
            revert MultiVault_InvalidArrayLength();
        }

        received = new uint256[](termIds.length);

        if (termIds.length != curveIds.length || termIds.length != shares.length || termIds.length != minAssets.length)
        {
            revert MultiVault_ArraysNotSameLength();
        }

        if (!_isApprovedToRedeem(msg.sender, receiver)) {
            revert MultiVault_SenderNotApproved();
        }

        uint256 _totalAssetsBeforeFees;
        for (uint256 i = 0; i < termIds.length;) {
            (uint256 assetsBeforeFees, uint256 assetsAfterFees) =
                _processRedeem(msg.sender, receiver, termIds[i], curveIds[i], shares[i], minAssets[i]);
            _totalAssetsBeforeFees += assetsBeforeFees;
            received[i] = assetsAfterFees;
            unchecked {
                ++i;
            }
        }

        _removeUtilization(receiver, int256(_totalAssetsBeforeFees));

        return received;
    }

    /// @notice Internal utility function to process a redemption
    /// @param sender The address of the sender
    /// @param receiver The address of the receiver
    /// @param termId The ID of the atom or triple
    /// @param curveId The ID of the bonding curve
    /// @param shares The amount of shares to redeem
    /// @param minAssets The minimum amount of assets to receive after fees
    /// @return rawAssetsBeforeFees The raw assets before fees
    /// @return assetsAfterFees The assets after fees
    function _processRedeem(
        address sender,
        address receiver,
        bytes32 termId,
        uint256 curveId,
        uint256 shares,
        uint256 minAssets
    )
        internal
        returns (uint256, uint256)
    {
        VaultType _vaultType = _getVaultType(termId);

        _validateRedeem(termId, curveId, receiver, shares, minAssets);

        uint256 rawAssetsBeforeFees = _convertToAssets(termId, curveId, shares);

        (uint256 assetsAfterFees,) = _calculateRedeem(termId, curveId, shares);

        /* --- Accumulate fees for all vault types --- */
        _accumulateVaultProtocolFees(rawAssetsBeforeFees);

        /* --- Add vault and triple fees to vault (Protocol Owned) --- */
        if (_shouldChargeExitFees(termId, curveId, shares)) {
            _increaseProRataVaultAssets(termId, _feeOnRaw(rawAssetsBeforeFees, vaultFees.exitFee), _vaultType);
        }

        /* --- Release user assets after fees from vault (User Owned) --- */
        uint256 userSharesAfter =
            _updateVaultOnRedeem(receiver, termId, curveId, rawAssetsBeforeFees, shares, _vaultType);

        Address.sendValue(payable(receiver), assetsAfterFees);

        emit Redeemed(
            sender,
            receiver,
            termId,
            curveId,
            shares,
            userSharesAfter,
            assetsAfterFees, // net assets sent to user
            rawAssetsBeforeFees - assetsAfterFees, // total fees charged
            _vaultType
        );

        return (rawAssetsBeforeFees, assetsAfterFees);
    }

    /* =================================================== */
    /*                       Wallet                        */
    /* =================================================== */

    /// @inheritdoc IMultiVault
    function claimAtomWalletDepositFees(bytes32 termId) external nonReentrant {
        address atomWalletAddress = _computeAtomWalletAddr(termId);

        // Restrict access to the associated atom wallet
        if (msg.sender != atomWalletAddress) {
            revert MultiVault_OnlyAssociatedAtomWallet();
        }

        uint256 accumulatedFeesForAtomWallet = accumulatedAtomWalletDepositFees[atomWalletAddress];

        // Transfer accumulated fees to the atom wallet owner
        if (accumulatedFeesForAtomWallet > 0) {
            accumulatedAtomWalletDepositFees[atomWalletAddress] = 0;
            address atomWalletOwner = IAtomWallet(payable(atomWalletAddress)).owner();

            Address.sendValue(payable(atomWalletOwner), accumulatedFeesForAtomWallet);

            emit AtomWalletDepositFeesClaimed(termId, atomWalletOwner, accumulatedFeesForAtomWallet);
        }
    }

    /* =================================================== */
    /*                        Protocol                     */
    /* =================================================== */

    /// @inheritdoc IMultiVault
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused {
        _pause();
    }

    /// @inheritdoc IMultiVault
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) whenPaused {
        _unpause();
    }

    /// @inheritdoc IMultiVault
    function setGeneralConfig(GeneralConfig memory _generalConfig) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setGeneralConfig(_generalConfig);
        emit GeneralConfigUpdated(
            _generalConfig.admin,
            _generalConfig.protocolMultisig,
            _generalConfig.feeDenominator,
            _generalConfig.trustBonding,
            _generalConfig.minDeposit,
            _generalConfig.minShare,
            _generalConfig.atomDataMaxLength,
            _generalConfig.feeThreshold
        );
    }

    /// @inheritdoc IMultiVault
    function setAtomConfig(AtomConfig memory _atomConfig) external onlyRole(DEFAULT_ADMIN_ROLE) {
        atomConfig = _atomConfig;
        emit AtomConfigUpdated(_atomConfig.atomCreationProtocolFee, _atomConfig.atomWalletDepositFee);
    }

    /// @inheritdoc IMultiVault
    function setTripleConfig(TripleConfig memory _tripleConfig) external onlyRole(DEFAULT_ADMIN_ROLE) {
        tripleConfig = _tripleConfig;
        emit TripleConfigUpdated(_tripleConfig.tripleCreationProtocolFee, _tripleConfig.atomDepositFractionForTriple);
    }

    /// @inheritdoc IMultiVault
    function setWalletConfig(WalletConfig memory _walletConfig) external onlyRole(DEFAULT_ADMIN_ROLE) {
        walletConfig = _walletConfig;
        emit WalletConfigUpdated(
            _walletConfig.entryPoint,
            _walletConfig.atomWarden,
            _walletConfig.atomWalletBeacon,
            _walletConfig.atomWalletFactory
        );
    }

    /// @inheritdoc IMultiVault
    function setVaultFees(VaultFees memory _vaultFees) external onlyRole(DEFAULT_ADMIN_ROLE) {
        vaultFees = _vaultFees;
        emit VaultFeesUpdated(_vaultFees.entryFee, _vaultFees.exitFee, _vaultFees.protocolFee);
    }

    /// @inheritdoc IMultiVault
    function setBondingCurveConfig(BondingCurveConfig memory _bondingCurveConfig)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        bondingCurveConfig = _bondingCurveConfig;
        emit BondingCurveConfigUpdated(_bondingCurveConfig.registry, _bondingCurveConfig.defaultCurveId);
    }

    /// @inheritdoc IMultiVault
    function sweepAccumulatedProtocolFees(uint256 epoch) external {
        _claimAccumulatedProtocolFees(epoch);
    }

    /* =================================================== */
    /*                    Accumulators                     */
    /* =================================================== */

    /// @dev Increase the accumulated protocol fees in a given epoch by a percentage of the raw assets
    /// @param _assets the raw amount of assets to calculate fees on
    function _accumulateVaultProtocolFees(uint256 _assets) internal {
        uint256 _fees = _feeOnRaw(_assets, vaultFees.protocolFee);
        uint256 epoch = _currentEpoch();
        accumulatedProtocolFees[epoch] += _fees;
        emit ProtocolFeeAccrued(epoch, msg.sender, _fees);
    }

    /// @dev Increase the accumulated protocol fees in a given epoch by an absolute amount
    /// @param _assets the absolute amount of assets to add to the accumulated protocol fees
    function _accumulateStaticProtocolFees(uint256 _assets) internal {
        uint256 epoch = _currentEpoch();
        accumulatedProtocolFees[epoch] += _assets;
        emit ProtocolFeeAccrued(epoch, msg.sender, _assets);
    }

    /// @dev Increase the accumulated atom wallet fees
    /// @param _termId the atom ID
    /// @param _assets the number of assets to calculate fees on
    /// @return atomWalletAddress the address of the atom wallet for the given atom ID
    function _accumulateAtomWalletFees(bytes32 _termId, uint256 _assets) internal returns (address) {
        address atomWalletAddress = _computeAtomWalletAddr(_termId);
        uint256 atomWalletDepositFee = _feeOnRaw(_assets, atomConfig.atomWalletDepositFee);
        accumulatedAtomWalletDepositFees[atomWalletAddress] += atomWalletDepositFee;
        emit AtomWalletDepositFeeCollected(_termId, msg.sender, atomWalletDepositFee);
        return atomWalletAddress;
    }

    /* =================================================== */
    /*                    Calculate                        */
    /* =================================================== */

    /// @dev calculates the assets received after fees and shares minted for a given deposit
    /// @param termId the atom or triple ID
    /// @param curveId the bonding curve ID
    /// @param assets the number of assets to deposit
    /// @param isAtomVault whether the vault is an atom or triple vault
    /// @return shares the number of shares that would be minted for the deposit
    /// @return assetsAfterMinSharesCost the assets remaining after min shares cost (if applicable)
    /// @return assetsAfterFees the assets remaining after all fees
    function _calculateDeposit(
        bytes32 termId,
        uint256 curveId,
        uint256 assets,
        bool isAtomVault
    )
        internal
        view
        returns (uint256 shares, uint256 assetsAfterMinSharesCost, uint256 assetsAfterFees)
    {
        if (isAtomVault) {
            return _calculateAtomDeposit(termId, curveId, assets);
        } else {
            return _calculateTripleDeposit(termId, curveId, assets);
        }
    }

    /// @dev calculates the assets received after fees and shares minted for a given creation deposit
    /// @param termId the atom or triple ID
    /// @param assets the number of assets to deposit
    /// @return shares the number of shares that would be minted for the deposit
    /// @return assetsAfterFixedFees the assets remaining after fixed fees (atom/triple cost)
    /// @return assetsAfterFees the assets remaining after all fees
    function _calculateAtomCreate(
        bytes32 termId,
        uint256 assets
    )
        internal
        view
        returns (uint256 shares, uint256 assetsAfterFixedFees, uint256 assetsAfterFees)
    {
        uint256 curveId = bondingCurveConfig.defaultCurveId;
        uint256 atomCost = _getAtomCost();

        if (assets < atomCost) {
            revert MultiVault_InsufficientAssets();
        }

        assetsAfterFixedFees = assets - atomCost;

        uint256 protocolFee = _feeOnRaw(assetsAfterFixedFees, vaultFees.protocolFee);
        uint256 atomWalletDepositFee = _feeOnRaw(assetsAfterFixedFees, atomConfig.atomWalletDepositFee);

        assetsAfterFees = assetsAfterFixedFees - protocolFee - atomWalletDepositFee;
        shares = _convertToShares(termId, curveId, assetsAfterFees);

        return (shares, assetsAfterFixedFees, assetsAfterFees);
    }

    /// @dev calculates the assets received after fees and shares minted for a given deposit
    /// @param termId the atom or triple ID
    /// @param curveId the bonding curve ID
    /// @param assets the number of assets to deposit
    /// @return shares the number of shares that would be minted for the deposit
    /// @return assetsAfterFees the assets remaining after all fees
    function _calculateAtomDeposit(
        bytes32 termId,
        uint256 curveId,
        uint256 assets // assets before any fees
    )
        internal
        view
        returns (uint256, uint256, uint256)
    {
        uint256 assetsAfterFees;
        uint256 assetsAfterMinSharesCost = assets;

        // Account for the minShare cost
        if (_isNewVault(termId, curveId)) {
            uint256 minShareCost = _minShareCostFor(VaultType.ATOM, curveId);
            if (assets <= minShareCost) revert MultiVault_DepositTooSmallToCoverMinShares();
            assetsAfterMinSharesCost -= minShareCost;
        }

        uint256 protocolFee = _feeOnRaw(assetsAfterMinSharesCost, vaultFees.protocolFee);
        uint256 entryFee = _shouldChargeFees(termId) ? _feeOnRaw(assetsAfterMinSharesCost, vaultFees.entryFee) : 0;
        uint256 atomWalletDepositFee = _feeOnRaw(assetsAfterMinSharesCost, atomConfig.atomWalletDepositFee);

        assetsAfterFees = assetsAfterMinSharesCost - protocolFee - entryFee - atomWalletDepositFee;

        // If it's an initial deposit into a non-default curve vault, we calculate user's shares as if minShare was
        // already minted
        uint256 shares = _isNewVault(termId, curveId)
            ? IBondingCurveRegistry(bondingCurveConfig.registry)
                .previewDeposit(
                    assetsAfterFees,
                    _minAssetsForCurve(curveId, generalConfig.minShare),
                    generalConfig.minShare,
                    curveId
                )
            : _convertToShares(termId, curveId, assetsAfterFees);
        return (shares, assetsAfterMinSharesCost, assetsAfterFees);
    }

    /// @dev calculates the assets received after fees and shares minted for a given creation deposit
    /// @param termId the atom or triple ID
    /// @param assets the number of assets to deposit
    /// @return shares the number of shares that would be minted for the deposit
    /// @return assetsAfterFixedFees the assets remaining after fixed fees (atom/triple cost)
    /// @return assetsAfterFees the assets remaining after all fees
    function _calculateTripleCreate(bytes32 termId, uint256 assets) internal view returns (uint256, uint256, uint256) {
        uint256 curveId = bondingCurveConfig.defaultCurveId;
        uint256 tripleCost = _getTripleCost();

        if (assets < tripleCost) {
            revert MultiVault_InsufficientAssets();
        }

        uint256 assetsAfterFixedFees = assets - tripleCost;

        uint256 protocolFee = _feeOnRaw(assetsAfterFixedFees, vaultFees.protocolFee);
        uint256 atomDepositFraction = _shouldChargeAtomDepositFraction(termId)
            ? _feeOnRaw(assetsAfterFixedFees, tripleConfig.atomDepositFractionForTriple)
            : 0;

        uint256 assetsAfterFees = assetsAfterFixedFees - protocolFee - atomDepositFraction;
        uint256 shares = _convertToShares(termId, curveId, assetsAfterFees);

        return (shares, assetsAfterFixedFees, assetsAfterFees);
    }

    /// @dev calculates the assets received after fees and shares minted for a given deposit
    /// @param termId the atom or triple ID
    /// @param curveId the bonding curve ID
    /// @param assets the number of assets to deposit
    /// @return shares the number of shares that would be minted for the deposit
    /// @return assetsAfterFees the assets remaining after all fees
    function _calculateTripleDeposit(
        bytes32 termId,
        uint256 curveId,
        uint256 assets // assets before any fees
    )
        internal
        view
        returns (uint256, uint256, uint256)
    {
        uint256 assetsAfterFees;
        uint256 assetsAfterMinSharesCost = assets;

        if (_isNewVault(termId, curveId) && _isCounterTriple(termId)) {
            revert MultiVault_CannotDirectlyInitializeCounterTriple();
        }

        // Account for the minShare cost
        if (_isNewVault(termId, curveId)) {
            uint256 minShareCost = _minShareCostFor(VaultType.TRIPLE, curveId);
            if (assets <= minShareCost) revert MultiVault_DepositTooSmallToCoverMinShares();
            assetsAfterMinSharesCost -= minShareCost;
        }

        uint256 protocolFee = _feeOnRaw(assetsAfterMinSharesCost, vaultFees.protocolFee);
        uint256 entryFee = _shouldChargeFees(termId) ? _feeOnRaw(assetsAfterMinSharesCost, vaultFees.entryFee) : 0;
        uint256 atomDepositFraction = _shouldChargeAtomDepositFraction(termId)
            ? _feeOnRaw(assetsAfterMinSharesCost, tripleConfig.atomDepositFractionForTriple)
            : 0;

        assetsAfterFees = assetsAfterMinSharesCost - protocolFee - entryFee - atomDepositFraction;

        // If it's an initial deposit into a non-default curve vault, we calculate user's shares as if minShare was
        // already minted
        uint256 shares = _isNewVault(termId, curveId)
            ? IBondingCurveRegistry(bondingCurveConfig.registry)
                .previewDeposit(
                    assetsAfterFees,
                    _minAssetsForCurve(curveId, generalConfig.minShare),
                    generalConfig.minShare,
                    curveId
                )
            : _convertToShares(termId, curveId, assetsAfterFees);
        return (shares, assetsAfterMinSharesCost, assetsAfterFees);
    }

    /// @dev calculates the assets received after fees and shares burned for a given share redemption
    /// @param _termId the atom or triple ID
    /// @param _curveId the bonding curve ID
    /// @param _shares the number of shares to redeem
    /// @return assetsAfterFees the assets remaining after all fees
    /// @return sharesUsed the number of shares that would be burned for the redemption
    function _calculateRedeem(
        bytes32 _termId,
        uint256 _curveId,
        uint256 _shares
    )
        internal
        view
        returns (uint256, uint256)
    {
        uint256 assets = _convertToAssets(_termId, _curveId, _shares);

        uint256 protocolFee = _feeOnRaw(assets, vaultFees.protocolFee);
        uint256 exitFee = _shouldChargeExitFees(_termId, _curveId, _shares) ? _feeOnRaw(assets, vaultFees.exitFee) : 0;

        uint256 assetsAfterFees = assets - protocolFee - exitFee;

        return (assetsAfterFees, _shares);
    }

    /* =================================================== */
    /*                      Pro Rata                       */
    /* =================================================== */

    /// @dev Increases the total assets of the pro-rata vaults for each atom in a triple
    /// @param tripleId the triple ID
    /// @param amount the amount to increase the total assets by
    /// @notice the amount is split equally among the three atom vaults, any negligible dust amount stays in the
    /// contract
    function _increaseProRataVaultsAssets(bytes32 tripleId, uint256 amount) internal {
        (bytes32 subjectId, bytes32 predicateId, bytes32 objectId) = _getTriple(tripleId);

        uint256 amountPerTerm = amount / 3; // negligible dust amount stays in the contract (i.e. only one or a few wei)

        _increaseProRataVaultAssets(subjectId, amountPerTerm, _getVaultType(subjectId));
        _increaseProRataVaultAssets(predicateId, amountPerTerm, _getVaultType(predicateId));
        _increaseProRataVaultAssets(objectId, amountPerTerm, _getVaultType(objectId));
    }

    /// @dev Increases the total assets of the pro-rata vault for a given termId and curveId
    /// @param termId the atom or triple ID
    /// @param amount the amount to increase the total assets by
    /// @param vaultType the type of vault (ATOM, TRIPLE, COUNTER_TRIPLE)
    function _increaseProRataVaultAssets(bytes32 termId, uint256 amount, VaultType vaultType) internal {
        uint256 curveId = bondingCurveConfig.defaultCurveId;
        VaultState storage vaultState = _vaults[termId][curveId];
        _setVaultTotals(termId, curveId, vaultState.totalAssets + amount, vaultState.totalShares, vaultType);
    }

    /* =================================================== */
    /*                 INTERNAL FUNCTIONS                  */
    /* =================================================== */

    /// @dev internal function to compute the address of the atom wallet for a given atom ID
    /// @param atomId the atom ID
    /// @return the address of the atom wallet
    function _computeAtomWalletAddr(bytes32 atomId) internal view returns (address) {
        return IAtomWalletFactory(walletConfig.atomWalletFactory).computeAtomWalletAddr(atomId);
    }

    /// @dev internal function that returns the current epoch from the TrustBonding contract
    /// @return the current epoch number
    function _currentEpoch() internal view returns (uint256) {
        return ITrustBonding(generalConfig.trustBonding).currentEpoch();
    }

    /// @dev checks if a vault for the given termId and curveId is new (i.e. has never had shares minted)
    /// @param termId the atom or triple ID
    function _isTermCreated(bytes32 termId) internal view returns (bool) {
        return _atoms[termId].length > 0 || _isTriple[termId];
    }

    function _requireVaultType(bytes32 termId) internal view returns (bool isAtomType, VaultType vaultType) {
        vaultType = _getVaultType(termId);
        return (vaultType == VaultType.ATOM, vaultType);
    }

    /// @dev calculates the fee on a raw amount provided as input
    /// @param amount the raw amount to calculate the fee on
    function _feeOnRaw(uint256 amount, uint256 fee) internal view returns (uint256) {
        return amount.mulDivUp(fee, generalConfig.feeDenominator);
    }

    /// @dev checks if an atom with the given termId exists
    /// @param termId the atom ID
    function _requireAtom(bytes32 termId) internal view {
        if (_atoms[termId].length == 0) {
            revert MultiVault_AtomDoesNotExist(termId);
        }
    }

    /// @dev checks if a triple with the given termId already exists
    /// @param termId the triple ID
    /// @param subjectId the subject atom ID
    /// @param predicateId the predicate atom ID
    /// @param objectId the object atom ID
    /// @notice reverts if the triple already exists
    function _tripleExists(bytes32 termId, bytes32 subjectId, bytes32 predicateId, bytes32 objectId) internal view {
        if (_triples[termId][0] != bytes32(0)) {
            revert MultiVault_TripleExists(termId, subjectId, predicateId, objectId);
        }
    }

    function _requireTermExists(bytes32 termId) internal view {
        if (!_isTermCreated(termId)) {
            revert MultiVault_TermDoesNotExist(termId);
        }
    }

    /// @dev checks if the receiver has any shares in the opposite side of a triple vault
    /// @param tripleId the triple ID
    /// @param curveId the bonding curve ID
    /// @param receiver the address to check for counter stake
    /// @return true if the receiver has shares in the opposite side of the triple, false otherwise
    function _hasCounterStake(bytes32 tripleId, uint256 curveId, address receiver) internal view returns (bool) {
        if (!_isTriple[tripleId]) {
            revert MultiVault_TermNotTriple();
        }

        // Find the "other side" of this triple
        bytes32 oppositeId = _getInverseTripleId(tripleId);

        return _vaults[oppositeId][curveId].balanceOf[receiver] > 0;
    }

    /// @dev calculates the number of shares that would be received for a given asset deposit into a vault of a given
    /// curve
    /// @param termId the atom or triple ID
    /// @param curveId the bonding curve ID
    /// @param assets the amount of assets to deposit
    /// @return the number of shares that would be received
    function _convertToShares(bytes32 termId, uint256 curveId, uint256 assets) internal view returns (uint256) {
        IBondingCurveRegistry bcRegistry = IBondingCurveRegistry(bondingCurveConfig.registry);
        return bcRegistry.previewDeposit(
            assets, _vaults[termId][curveId].totalAssets, _vaults[termId][curveId].totalShares, curveId
        );
    }

    /// @dev calculates the amount of assets that would be received for a given share redemption from a vault of a given
    /// curve
    /// @param termId the atom or triple ID
    /// @param curveId the bonding curve ID
    /// @param shares the amount of shares to redeem
    /// @return the amount of assets that would be received
    function _convertToAssets(bytes32 termId, uint256 curveId, uint256 shares) internal view returns (uint256) {
        IBondingCurveRegistry bcRegistry = IBondingCurveRegistry(bondingCurveConfig.registry);
        return bcRegistry.previewRedeem(
            shares, _vaults[termId][curveId].totalShares, _vaults[termId][curveId].totalAssets, curveId
        );
    }

    /// @dev Initializes the counter triple vault with min shares minted to the burn address
    /// @param counterTripleId the ID of the counter triple
    /// @param curveId the bonding curve ID
    function _initializeCounterTripleVault(bytes32 counterTripleId, uint256 curveId) internal {
        VaultState storage vaultState = _vaults[counterTripleId][curveId];
        uint256 minShare = generalConfig.minShare;

        _setVaultTotals(
            counterTripleId,
            curveId,
            vaultState.totalAssets + _minAssetsForCurve(curveId, minShare),
            vaultState.totalShares + minShare,
            VaultType.COUNTER_TRIPLE
        );

        // Mint min shares to the burn address for the counter vault
        _mint(BURN_ADDRESS, counterTripleId, curveId, minShare);
    }

    /// @dev mint vault shares to address `to`
    /// @param to address to mint shares to
    /// @param termId atom or triple ID to mint shares for (term)
    /// @param curveId bonding curve ID to mint shares for
    /// @param amount amount of shares to mint
    function _mint(address to, bytes32 termId, uint256 curveId, uint256 amount) internal returns (uint256) {
        _vaults[termId][curveId].balanceOf[to] += amount;
        return _vaults[termId][curveId].balanceOf[to];
    }

    /// @dev burn `amount` vault shares from address `from`
    /// @param from address to burn shares from
    /// @param termId atom or triple ID to burn shares from (term)
    /// @param curveId bonding curve ID to burn shares from
    /// @param amount amount of shares to burn
    function _burn(address from, bytes32 termId, uint256 curveId, uint256 amount) internal returns (uint256) {
        if (from == address(0)) revert MultiVault_BurnFromZeroAddress();

        mapping(address => uint256) storage balances = _vaults[termId][curveId].balanceOf;
        uint256 fromBalance = balances[from];

        if (fromBalance < amount) {
            revert MultiVault_BurnInsufficientBalance();
        }

        uint256 newBalance;
        unchecked {
            newBalance = fromBalance - amount;
            balances[from] = newBalance;
        }

        return newBalance;
    }

    /// @dev Adds the new utilization of the system and the user
    /// @param user the address of the user
    /// @param totalValue the total value of the deposit
    function _addUtilization(address user, int256 totalValue) internal {
        // First, roll the user's old epoch usage forward so we adjust the current epoch’s usage
        _rollover(user);

        uint256 epoch = _currentEpoch();

        uint256[3] storage _userEpochHistory = userEpochHistory[user];
        if (_userEpochHistory[0] != epoch) {
            if (_userEpochHistory[0] != 0) {
                // Shift the history: ppa <- pa <- prev
                _userEpochHistory[2] = _userEpochHistory[1];
                _userEpochHistory[1] = _userEpochHistory[0];
            }

            _userEpochHistory[0] = epoch;
        }

        totalUtilization[epoch] += totalValue;
        emit TotalUtilizationAdded(epoch, totalValue, totalUtilization[epoch]);

        personalUtilization[user][epoch] += totalValue;
        emit PersonalUtilizationAdded(user, epoch, totalValue, personalUtilization[user][epoch]);
    }

    /// @dev Removes the utilization of the system and the user
    /// @param user the address of the user
    /// @param amountToRemove the amount of utilization to remove
    function _removeUtilization(address user, int256 amountToRemove) internal {
        // First, roll the user's old epoch usage forward so we adjust the current epoch’s usage
        _rollover(user);

        uint256 epoch = _currentEpoch();
        uint256[3] storage _userEpochHistory = userEpochHistory[user];
        if (_userEpochHistory[0] != epoch) {
            if (_userEpochHistory[0] != 0) {
                // Shift the history: ppa <- pa <- prev
                _userEpochHistory[2] = _userEpochHistory[1];
                _userEpochHistory[1] = _userEpochHistory[0];
            }

            _userEpochHistory[0] = epoch;
        }

        totalUtilization[epoch] -= amountToRemove;
        emit TotalUtilizationRemoved(epoch, amountToRemove, totalUtilization[epoch]);

        personalUtilization[user][epoch] -= amountToRemove;
        emit PersonalUtilizationRemoved(user, epoch, amountToRemove, personalUtilization[user][epoch]);
    }

    /// @dev Rollover utilization if needed: move leftover from old epoch to current epoch
    ///      and update the system utilization accordingly
    /// @param user the address of the user
    function _rollover(address user) internal {
        uint256 currentEpochLocal = _currentEpoch();
        uint256 userLastEpoch = userEpochHistory[user][0];

        // First, handle the system-wide rollover if this is the first action in the new epoch
        if (currentEpochLocal > 0 && totalUtilization[currentEpochLocal] == 0) {
            // Roll over from the immediately previous epoch
            uint256 previousEpoch = currentEpochLocal - 1;
            if (totalUtilization[previousEpoch] != 0) {
                totalUtilization[currentEpochLocal] = totalUtilization[previousEpoch];
            }
        }

        // Then handle the user-specific rollover
        if (userLastEpoch == currentEpochLocal) {
            return; // already up to date; no rollover needed
        }

        // User's first action in a new epoch - roll over their personal utilization from their respective last active
        // epoch
        int256 lastEpochUtilization = personalUtilization[user][userLastEpoch];
        if (lastEpochUtilization != 0 && personalUtilization[user][currentEpochLocal] == 0) {
            personalUtilization[user][currentEpochLocal] = lastEpochUtilization;
        }
    }

    /// @dev collects the accumulated protocol fees and transfers them to the protocol multisig
    /// @param epoch the epoch to claim the protocol fees for
    function _claimAccumulatedProtocolFees(uint256 epoch) internal {
        uint256 protocolFees = accumulatedProtocolFees[epoch];
        if (protocolFees == 0) return;

        accumulatedProtocolFees[epoch] = 0;

        Address.sendValue(payable(generalConfig.protocolMultisig), protocolFees);

        emit ProtocolFeeTransferred(epoch, generalConfig.protocolMultisig, protocolFees);
    }

    /// @dev Updates the vault state on creation of a new vault
    /// @param receiver the address of the user receiving shares
    /// @param termId the atom or triple ID
    /// @param curveId the bonding curve ID
    /// @param assets the amount of assets being deposited
    /// @param shares the amount of shares being minted
    /// @param vaultType the type of the vault (ATOM, TRIPLE, COUNTER_TRIPLE)
    /// @return userSharesAfter the user's share balance after the creation
    function _updateVaultOnCreation(
        address receiver,
        bytes32 termId,
        uint256 curveId,
        uint256 assets,
        uint256 shares,
        VaultType vaultType
    )
        internal
        returns (uint256)
    {
        uint256 minShare = generalConfig.minShare;
        VaultState storage vaultState = _vaults[termId][curveId];

        _setVaultTotals(
            termId,
            curveId,
            vaultState.totalAssets + assets + _minAssetsForCurve(curveId, minShare),
            vaultState.totalShares + shares + minShare,
            vaultType
        );

        uint256 sharesTotal = _mint(receiver, termId, curveId, shares);

        // Mint min shares to the burn address. Once created, the vault can never have less than min shares.
        _mint(BURN_ADDRESS, termId, curveId, minShare);

        return sharesTotal;
    }

    /// @dev Updates the vault state on a deposit operation
    /// @param receiver the address of the user receiving shares
    /// @param termId the atom or triple ID
    /// @param curveId the bonding curve ID
    /// @param assets the amount of assets being deposited
    /// @param shares the amount of shares being minted
    /// @param _vaultType the type of the vault (ATOM, TRIPLE, COUNTER_TRIPLE)
    /// @return userSharesAfter the user's share balance after the deposit
    function _updateVaultOnDeposit(
        address receiver,
        bytes32 termId,
        uint256 curveId,
        uint256 assets,
        uint256 shares,
        VaultType _vaultType
    )
        internal
        returns (uint256)
    {
        _setVaultTotals(
            termId,
            curveId,
            _vaults[termId][curveId].totalAssets + assets,
            _vaults[termId][curveId].totalShares + shares,
            _vaultType
        );

        return _mint(receiver, termId, curveId, shares);
    }

    /// @dev Updates the vault state on a redeem operation
    /// @param sender the address of the user redeeming shares
    /// @param termId the atom or triple ID
    /// @param curveId the bonding curve ID
    /// @param assets the amount of assets being redeemed
    /// @param shares the amount of shares being redeemed
    /// @param vaultType the type of the vault (ATOM, TRIPLE, COUNTER_TRIPLE)
    /// @return userSharesAfter the user's share balance after the redeem
    function _updateVaultOnRedeem(
        address sender,
        bytes32 termId,
        uint256 curveId,
        uint256 assets,
        uint256 shares,
        VaultType vaultType
    )
        internal
        returns (uint256)
    {
        VaultState storage vaultState = _vaults[termId][curveId];

        _setVaultTotals(termId, curveId, vaultState.totalAssets - assets, vaultState.totalShares - shares, vaultType);

        return _burn(sender, termId, curveId, shares);
    }

    /// @dev Sets the total assets and shares for a given vault, and emits a SharePriceChanged event
    /// @param termId the atom or triple ID
    /// @param curveId the bonding curve ID
    /// @param totalAssets the new total assets for the vault
    /// @param totalShares the new total shares for the vault
    /// @param vaultType the type of the vault (ATOM, TRIPLE, COUNTER_TRIPLE)
    function _setVaultTotals(
        bytes32 termId,
        uint256 curveId,
        uint256 totalAssets,
        uint256 totalShares,
        VaultType vaultType
    )
        internal
    {
        IBondingCurveRegistry registry = IBondingCurveRegistry(bondingCurveConfig.registry);

        uint256 maxAssets = registry.getCurveMaxAssets(curveId);
        uint256 maxShares = registry.getCurveMaxShares(curveId);
        if (totalAssets > maxAssets) revert MultiVault_ActionExceedsMaxAssets();
        if (totalShares > maxShares) revert MultiVault_ActionExceedsMaxShares();

        VaultState storage vaultState = _vaults[termId][curveId];
        vaultState.totalAssets = totalAssets;
        vaultState.totalShares = totalShares;

        uint256 price = registry.currentPrice(curveId, totalShares, totalAssets);

        emit SharePriceChanged(termId, curveId, price, totalAssets, totalShares, vaultType);
    }

    /// @dev Validate that a deposit meets the minimum deposit requirement
    /// @param _assets the amount of assets to deposit
    function _validateMinDeposit(uint256 _assets) internal view {
        if (_assets < generalConfig.minDeposit) {
            revert MultiVault_DepositBelowMinimumDeposit();
        }
    }

    /// @dev Validate the payment for a batch operation
    /// @param assets the array of asset amounts for each operation in the batch
    /// @return total the total amount of assets for the batch
    function _validatePayment(uint256[] calldata assets) internal view returns (uint256 total) {
        uint256 length = assets.length;

        if (length == 0 || length > MAX_BATCH_SIZE) {
            revert MultiVault_InvalidArrayLength();
        }
        for (uint256 i = 0; i < length;) {
            total += assets[i];
            unchecked {
                ++i;
            }
        }

        if (msg.value != total) {
            revert MultiVault_InsufficientBalance();
        }

        return total;
    }

    function _validateMinShares(
        bytes32 termId,
        uint256 curveId,
        uint256 assets,
        uint256 sharesForReceiver,
        uint256 assetsAfterMinSharesCost,
        uint256 assetsAfterFees,
        uint256 minSharesForReceiver
    )
        internal
        view
    {
        IBondingCurveRegistry registry = IBondingCurveRegistry(bondingCurveConfig.registry);

        // Prevent zero share deposits
        if (sharesForReceiver == 0) revert MultiVault_DepositOrRedeemZeroShares();

        bool isNew = _isNewVault(termId, curveId);
        uint256 minShareCost = assets - assetsAfterMinSharesCost;

        // Check the incoming assets will not exceed max assets for the curve
        uint256 projectedAssets = _vaults[termId][curveId].totalAssets + assetsAfterFees + minShareCost;
        if (projectedAssets > registry.getCurveMaxAssets(curveId)) revert MultiVault_ActionExceedsMaxAssets();

        // Check the incoming shares will not exceed max shares for the curve
        uint256 projectedShares =
            _vaults[termId][curveId].totalShares + sharesForReceiver + (isNew ? generalConfig.minShare : 0);
        if (projectedShares > registry.getCurveMaxShares(curveId)) revert MultiVault_ActionExceedsMaxShares();

        // Ensure the deposit converts to at least minSharesForReceiver shares
        if (sharesForReceiver < minSharesForReceiver) {
            revert MultiVault_SlippageExceeded();
        }
    }

    /// @dev Validate a redeem operation
    /// @param _termId the atom or triple ID
    /// @param _curveId the bonding curve ID
    /// @param _account the address of the account performing the redeem
    /// @param _shares the amount of shares to redeem
    /// @param _minAssets the minimum amount of assets to receive
    function _validateRedeem(
        bytes32 _termId,
        uint256 _curveId,
        address _account,
        uint256 _shares,
        uint256 _minAssets
    )
        internal
        view
    {
        if (_shares == 0) {
            revert MultiVault_DepositOrRedeemZeroShares();
        }

        if (_maxRedeem(_account, _termId, _curveId) < _shares) {
            revert MultiVault_InsufficientSharesInVault();
        }

        uint256 remainingShares = _vaults[_termId][_curveId].totalShares - _shares;
        if (remainingShares < generalConfig.minShare) {
            revert MultiVault_InsufficientRemainingSharesInVault(remainingShares);
        }

        (uint256 expectedAssets,) = _calculateRedeem(_termId, _curveId, _shares);

        if (expectedAssets < _minAssets) {
            revert MultiVault_SlippageExceeded();
        }
    }

    /// @notice Check if a sender is approved to deposit on behalf of a receiver
    /// @param sender The address of the sender
    /// @param receiver The address of the receiver
    /// @return bool Whether the sender is approved to deposit
    function _isApprovedToDeposit(address sender, address receiver) internal view returns (bool) {
        return sender == receiver || (approvals[receiver][sender] & uint8(ApprovalTypes.DEPOSIT)) != 0;
    }

    /// @notice Check if a sender is approved to redeem on behalf of a receiver
    /// @param sender The address of the sender
    /// @param receiver The address of the receiver
    /// @return bool Whether the sender is approved to redeem
    function _isApprovedToRedeem(address sender, address receiver) internal view returns (bool) {
        return sender == receiver || (approvals[receiver][sender] & uint8(ApprovalTypes.REDEMPTION)) != 0;
    }

    /// @notice Check if a vault is new (i.e. has no shares)
    /// @param termId The ID of the atom or triple
    /// @param curveId The ID of the bonding curve
    /// @return bool Whether the vault is new or not
    function _isNewVault(bytes32 termId, uint256 curveId) internal view returns (bool) {
        return _vaults[termId][curveId].totalShares == 0;
    }

    /// @notice Get the min shares cost for creating an atom or triple vault
    /// @param vaultType The type of vault
    /// @param curveId The ID of the bonding curve
    /// @return uint256 The min shares cost for a given vault
    function _minShareCostFor(VaultType vaultType, uint256 curveId) internal view returns (uint256) {
        uint256 minShareCost = _minAssetsForCurve(curveId, generalConfig.minShare);
        return vaultType == VaultType.ATOM ? minShareCost : minShareCost * 2;
    }

    /// @notice Get the amount of assets required to mint minShare shares for a given bonding curve
    /// @param curveId The ID of the bonding curve
    /// @param minShare The minimum shares required
    /// @return uint256 The amount of assets required to mint minShare shares
    function _minAssetsForCurve(uint256 curveId, uint256 minShare) internal view returns (uint256) {
        return IBondingCurveRegistry(bondingCurveConfig.registry).previewMint(minShare, 0, 0, curveId);
    }

    /// @notice Determine if fees should be charged based on the total shares in the default curve vault
    /// @dev This is put in place in order to avoid hyperinflating the share price on a default curve vault when flowing
    /// the fees from other curves to the default curve vault (entry fees, exit fees, or atom deposit fractions)
    /// @param termId The ID of the atom or triple
    /// @return bool Whether fees should be charged or not
    function _shouldChargeFees(bytes32 termId) internal view returns (bool) {
        uint256 defaultCurveId = bondingCurveConfig.defaultCurveId;
        uint256 totalShares = _vaults[termId][defaultCurveId].totalShares;
        if (totalShares < generalConfig.feeThreshold) return false;
        return true;
    }

    /// @notice Determine if exit fees should be charged based on the remaining total shares in the default curve vault
    /// after redemption
    /// @param termId The ID of the atom or triple
    /// @param curveId The ID of the bonding curve
    /// @param sharesToRedeem The number of shares to be redeemed
    /// @return bool Whether exit fees should be charged or not
    function _shouldChargeExitFees(
        bytes32 termId,
        uint256 curveId,
        uint256 sharesToRedeem
    )
        internal
        view
        returns (bool)
    {
        uint256 defaultCurveId = bondingCurveConfig.defaultCurveId;
        uint256 totalShares = _vaults[termId][defaultCurveId].totalShares;
        uint256 remainingSharesInDefaultVault;

        if (curveId == defaultCurveId) {
            remainingSharesInDefaultVault = totalShares - sharesToRedeem;
        } else {
            remainingSharesInDefaultVault = totalShares;
        }

        if (remainingSharesInDefaultVault < generalConfig.feeThreshold) return false;
        return true;
    }

    /// @notice Determine if the atom deposit fraction should be charged for a triple deposit
    /// @dev The atom deposit fraction is only charged if all three atoms in the triple should be charged fees (i.e. if
    /// their respective default curve vaults have enough shares already)
    /// @param tripleId The ID of the triple
    /// @return bool Whether the atom deposit fraction should be charged or not
    function _shouldChargeAtomDepositFraction(bytes32 tripleId) internal view returns (bool) {
        bytes32[3] memory atomIds = _triples[tripleId];
        return _shouldChargeFees(atomIds[0]) && _shouldChargeFees(atomIds[1]) && _shouldChargeFees(atomIds[2]);
    }

    /// @notice Get the maximum shares that can be redeemed by a user for a given vault
    /// @param sender The address of the user
    /// @param termId The ID of the atom or triple
    /// @param curveId The ID of the bonding curve
    function _maxRedeem(address sender, bytes32 termId, uint256 curveId) internal view returns (uint256) {
        return _vaults[termId][curveId].balanceOf[sender];
    }
}


// --- src/protocol/MultiVaultMigrationMode.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

import { MultiVault } from "src/protocol/MultiVault.sol";

/**
 * @title MultiVaultMigrationMode
 * @author 0xIntuition
 * @notice Contract for migrating the MultiVault data using an external script
 *         and the MIGRATOR_ROLE. After the core data is migrated, the MIGRATOR_ROLE
 *         should be permanently revoked. Final step of the migration also includes
 *         sending the correct amount of the underlying asset (TRUST tokens) to the
 *         MultiVault contract to back the shares. This contract will ultimately be
 *         upgraded to the standard MultiVault contract.
 */
contract MultiVaultMigrationMode is MultiVault {
    /*//////////////////////////////////////////////////////////////
                                 CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Role used for the state migration
    bytes32 public constant MIGRATOR_ROLE = keccak256("MIGRATOR_ROLE");

    /*//////////////////////////////////////////////////////////////
                                 STRUCTS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Struct representing the vault totals
     * @param totalAssets Total assets in the vault
     * @param totalShares Total shares in the vault
     */
    struct VaultTotals {
        uint256 totalAssets;
        uint256 totalShares;
    }

    /**
     * @notice Struct representing the parameters for batch setting user balances
     * @param termIds The term IDs of the vaults
     * @param bondingCurveId The bonding curve ID of all of the vaults
     * @param user The user whose balances are being set
     * @param userBalances The user balances for each vault
     */
    struct BatchSetUserBalancesParams {
        bytes32[][] termIds;
        uint256 bondingCurveId;
        address[] users;
        uint256[][] userBalances;
    }

    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error MultiVault_InvalidBondingCurveId();

    error MultiVault_ZeroAddress();

    /*//////////////////////////////////////////////////////////////
                             MIGRATION FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Allows contract to receive TRUST to back the migrated shares
    receive() external payable { }

    /*//////////////////////////////////////////////////////////////
                             MIGRATION FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Set the term count
     * @param _termCount The new term count
     */
    function setTermCount(uint256 _termCount) external onlyRole(MIGRATOR_ROLE) {
        totalTermsCreated = _termCount;
    }

    /**
     * @notice Sets the atom mappings data
     * @param creators The creators of the atoms
     * @param atomDataArray The atom data array
     */
    function batchSetAtomData(
        address[] calldata creators,
        bytes[] calldata atomDataArray
    )
        external
        onlyRole(MIGRATOR_ROLE)
    {
        uint256 length = atomDataArray.length;
        if (length != creators.length) {
            revert MultiVault_ArraysNotSameLength();
        }

        for (uint256 i = 0; i < length;) {
            bytes32 atomId = _calculateAtomId(atomDataArray[i]);
            _atoms[atomId] = atomDataArray[i];

            emit AtomCreated(creators[i], atomId, atomDataArray[i], _computeAtomWalletAddr(atomId));
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Sets the triple mappings data
     * @param creators The creators of the triples
     * @param tripleAtomIds The atom IDs for each triple (array of arrays)
     */
    function batchSetTripleData(
        address[] calldata creators,
        bytes32[3][] calldata tripleAtomIds
    )
        external
        onlyRole(MIGRATOR_ROLE)
    {
        uint256 length = tripleAtomIds.length;

        if (length != creators.length) {
            revert MultiVault_ArraysNotSameLength();
        }

        for (uint256 i = 0; i < length;) {
            bytes32 tripleId = _calculateTripleId(tripleAtomIds[i][0], tripleAtomIds[i][1], tripleAtomIds[i][2]);
            bytes32 counterTripleId = _calculateCounterTripleId(tripleId);

            _initializeTripleState(tripleId, counterTripleId, tripleAtomIds[i]);

            emit TripleCreated(creators[i], tripleId, tripleAtomIds[i][0], tripleAtomIds[i][1], tripleAtomIds[i][2]);
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Sets the vault totals for each vault
     * @param termIds The term IDs of the vaults
     * @param bondingCurveId The bonding curve ID of all of the vaults
     * @param vaultTotals The vault totals for each vault
     */
    function batchSetVaultTotals(
        bytes32[] calldata termIds,
        uint256 bondingCurveId,
        VaultTotals[] calldata vaultTotals
    )
        external
        onlyRole(MIGRATOR_ROLE)
    {
        if (bondingCurveId == 0) {
            revert MultiVault_InvalidBondingCurveId();
        }

        uint256 length = termIds.length;

        if (length != vaultTotals.length) {
            revert MultiVault_ArraysNotSameLength();
        }

        for (uint256 i = 0; i < length;) {
            _setVaultTotals(
                termIds[i],
                bondingCurveId,
                vaultTotals[i].totalAssets,
                vaultTotals[i].totalShares,
                _getVaultType(termIds[i])
            );
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Sets balances for multiple users across multiple termIds on a single bondingCurveId.
     *         For each user i, we take termIds[i] and userBalances[i] (lengths must match),
     *         and set balanceOf[user] for each termId.
     * @param params The parameters for the batch set user balances.
     */
    function batchSetUserBalances(BatchSetUserBalancesParams calldata params) external onlyRole(MIGRATOR_ROLE) {
        if (params.bondingCurveId == 0) {
            revert MultiVault_InvalidBondingCurveId();
        }

        uint256 usersLength = params.users.length;
        if (usersLength == 0 || usersLength != params.termIds.length || usersLength != params.userBalances.length) {
            revert MultiVault_InvalidArrayLength();
        }

        for (uint256 i = 0; i < usersLength;) {
            if (params.users[i] == address(0)) {
                revert MultiVault_ZeroAddress();
            }

            bytes32[] calldata terms = params.termIds[i];
            uint256[] calldata balances = params.userBalances[i];

            if (terms.length != balances.length) {
                revert MultiVault_InvalidArrayLength();
            }

            for (uint256 j = 0; j < terms.length;) {
                // Write user balance
                _vaults[terms[j]][params.bondingCurveId].balanceOf[params.users[i]] = balances[j];

                // Compute assets at current share price
                uint256 assets = _convertToAssets(terms[j], params.bondingCurveId, balances[j]);

                emit Deposited(
                    address(this), // sender (migration)
                    params.users[i], // receiver
                    terms[j],
                    params.bondingCurveId,
                    assets, // assets
                    assets, // assetsAfterFees (equivalent to assets for migration)
                    balances[j], // shares that were minted (i.e. set during migration)
                    balances[j], // totalShares (equivalent to shares for migration)
                    _getVaultType(terms[j])
                );

                unchecked {
                    ++j;
                }
            }

            unchecked {
                ++i;
            }
        }
    }
}


// --- src/protocol/emissions/BaseEmissionsController.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";

import { IBaseEmissionsController } from "src/interfaces/IBaseEmissionsController.sol";
import { ITrust } from "src/interfaces/ITrust.sol";
import { MetaERC20DispatchInit } from "src/interfaces/IMetaLayer.sol";
import { CoreEmissionsControllerInit } from "src/interfaces/ICoreEmissionsController.sol";
import { CoreEmissionsController } from "src/protocol/emissions/CoreEmissionsController.sol";
import { FinalityState, MetaERC20Dispatcher } from "src/protocol/emissions/MetaERC20Dispatcher.sol";

/**
 * @title  BaseEmissionsController
 * @author 0xIntuition
 * @notice Controls the release of TRUST tokens by sending mint requests to the TRUST token.
 */
contract BaseEmissionsController is
    IBaseEmissionsController,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    CoreEmissionsController,
    MetaERC20Dispatcher
{
    /* =================================================== */
    /*                     CONSTANTS                       */
    /* =================================================== */

    /// @notice Access control role for controllers who can mint tokens
    bytes32 public constant CONTROLLER_ROLE = keccak256("CONTROLLER_ROLE");

    /* =================================================== */
    /*                       STATE                         */
    /* =================================================== */

    /// @notice Trust token contract address
    address internal _TRUST_TOKEN;

    /// @notice Address of the emissions controller on the satellite chain
    address internal _SATELLITE_EMISSIONS_CONTROLLER;

    /// @notice Total amount of Trust tokens minted
    uint256 internal _totalMintedAmount;

    /// @notice Mapping of minted amounts for each epoch
    mapping(uint256 epoch => uint256 amount) internal _epochToMintedAmount;

    /// @dev Gap for upgrade safety
    uint256[50] private __gap;

    /* =================================================== */
    /*                    CONSTRUCTOR                      */
    /* =================================================== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address admin,
        address controller,
        address token,
        MetaERC20DispatchInit memory metaERC20DispatchInit,
        CoreEmissionsControllerInit memory checkpointInit
    )
        external
        initializer
    {
        if (admin == address(0) || controller == address(0) || token == address(0)) {
            revert BaseEmissionsController_InvalidAddress();
        }

        // Initialize the AccessControl and ReentrancyGuard contracts
        __AccessControl_init();
        __ReentrancyGuard_init();

        __CoreEmissionsController_init(
            checkpointInit.startTimestamp,
            checkpointInit.emissionsLength,
            checkpointInit.emissionsPerEpoch,
            checkpointInit.emissionsReductionCliff,
            checkpointInit.emissionsReductionBasisPoints
        );

        __MetaERC20Dispatcher_init(
            metaERC20DispatchInit.hubOrSpoke,
            metaERC20DispatchInit.recipientDomain,
            metaERC20DispatchInit.gasLimit,
            metaERC20DispatchInit.finalityState
        );

        // Assign the roles
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CONTROLLER_ROLE, controller);

        // Set the Trust token contract address
        _setTrustToken(token);
    }

    /// @notice Receive native gas token to fund cross-chain messages
    receive() external payable {
        emit Transfer(msg.sender, address(this), msg.value);
    }

    /* =================================================== */
    /*                      GETTERS                        */
    /* =================================================== */

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @inheritdoc IBaseEmissionsController
    function getTrustToken() external view returns (address) {
        return _TRUST_TOKEN;
    }

    /// @inheritdoc IBaseEmissionsController
    function getSatelliteEmissionsController() external view returns (address) {
        return _SATELLITE_EMISSIONS_CONTROLLER;
    }

    /// @inheritdoc IBaseEmissionsController
    function getTotalMinted() external view returns (uint256) {
        return _totalMintedAmount;
    }

    /// @inheritdoc IBaseEmissionsController
    function getEpochMintedAmount(uint256 epoch) external view returns (uint256) {
        return _epochToMintedAmount[epoch];
    }

    /* =================================================== */
    /*                    CONTROLLER                       */
    /* =================================================== */

    /// @inheritdoc IBaseEmissionsController
    function mintAndBridgeCurrentEpoch() external nonReentrant onlyRole(CONTROLLER_ROLE) {
        uint256 currentEpoch = _currentEpoch();
        uint256 gasLimit = _quoteGasPayment(_recipientDomain, GAS_CONSTANT + _messageGasCost);
        _mintAndBridge(currentEpoch, gasLimit);
    }

    /// @inheritdoc IBaseEmissionsController
    function mintAndBridge(uint256 epoch) external payable nonReentrant onlyRole(CONTROLLER_ROLE) {
        _mintAndBridge(epoch, msg.value);
    }

    /* =================================================== */
    /*                       ADMIN                         */
    /* =================================================== */

    /// @inheritdoc IBaseEmissionsController
    function setTrustToken(address newToken) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setTrustToken(newToken);
    }

    /// @inheritdoc IBaseEmissionsController
    function setSatelliteEmissionsController(address newSatellite) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setSatelliteEmissionsController(newSatellite);
    }

    /// @inheritdoc IBaseEmissionsController
    function setMessageGasCost(uint256 newGasCost) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setMessageGasCost(newGasCost);
    }

    /// @inheritdoc IBaseEmissionsController
    function setFinalityState(FinalityState newFinalityState) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setFinalityState(newFinalityState);
    }

    /// @inheritdoc IBaseEmissionsController
    function setMetaERC20SpokeOrHub(address newMetaERC20SpokeOrHub) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setMetaERC20SpokeOrHub(newMetaERC20SpokeOrHub);
    }

    /// @inheritdoc IBaseEmissionsController
    function setRecipientDomain(uint32 newRecipientDomain) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setRecipientDomain(newRecipientDomain);
    }

    /// @inheritdoc IBaseEmissionsController
    function burn(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (amount > _balanceBurnable()) {
            revert BaseEmissionsController_InsufficientBurnableBalance();
        }

        ITrust(_TRUST_TOKEN).burn(amount);

        emit TrustBurned(address(this), amount);
    }

    /// @inheritdoc IBaseEmissionsController
    function withdraw(uint256 amount) external nonReentrant onlyRole(DEFAULT_ADMIN_ROLE) {
        emit Transfer(address(this), msg.sender, amount);
        Address.sendValue(payable(msg.sender), amount);
    }

    /* =================================================== */
    /*                 INTERNAL FUNCTIONS                  */
    /* =================================================== */

    function _mintAndBridge(uint256 epoch, uint256 value) internal onlyRole(CONTROLLER_ROLE) {
        if (_SATELLITE_EMISSIONS_CONTROLLER == address(0)) {
            revert BaseEmissionsController_SatelliteEmissionsControllerNotSet();
        }

        uint256 currentEpoch = _currentEpoch();

        if (epoch > currentEpoch) {
            revert BaseEmissionsController_InvalidEpoch();
        }

        if (_epochToMintedAmount[epoch] > 0) {
            revert BaseEmissionsController_EpochMintingLimitExceeded();
        }

        uint256 amount = _emissionsAtEpoch(epoch);
        _totalMintedAmount += amount;
        _epochToMintedAmount[epoch] = amount;

        // Mint new TRUST using the calculated epoch emissions
        ITrust(_TRUST_TOKEN).mint(address(this), amount);
        IERC20(_TRUST_TOKEN).approve(_metaERC20SpokeOrHub, amount);

        // Bridge new emissions to the Satellite Emissions Controller
        uint256 gasLimit = _quoteGasPayment(_recipientDomain, GAS_CONSTANT + _messageGasCost);
        if (value < gasLimit) {
            revert BaseEmissionsController_InsufficientGasPayment();
        }

        _bridgeTokensViaERC20(
            _metaERC20SpokeOrHub,
            _recipientDomain,
            bytes32(uint256(uint160(_SATELLITE_EMISSIONS_CONTROLLER))),
            amount,
            gasLimit,
            _finalityState
        );

        if (value > gasLimit) {
            Address.sendValue(payable(msg.sender), value - gasLimit);
        }

        emit TrustMintedAndBridged(_SATELLITE_EMISSIONS_CONTROLLER, amount, epoch);
    }

    function _setTrustToken(address newToken) internal {
        if (newToken == address(0)) {
            revert BaseEmissionsController_InvalidAddress();
        }
        _TRUST_TOKEN = newToken;
        emit TrustTokenUpdated(newToken);
    }

    function _setSatelliteEmissionsController(address newSatellite) internal {
        if (newSatellite == address(0)) {
            revert BaseEmissionsController_InvalidAddress();
        }
        _SATELLITE_EMISSIONS_CONTROLLER = newSatellite;
        emit SatelliteEmissionsControllerUpdated(newSatellite);
    }

    function _balanceBurnable() internal view returns (uint256) {
        return IERC20(_TRUST_TOKEN).balanceOf(address(this));
    }
}


// --- src/protocol/emissions/TrustBonding.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import { ICoreEmissionsController } from "src/interfaces/ICoreEmissionsController.sol";
import { IMultiVault } from "src/interfaces/IMultiVault.sol";
import { ITrustBonding, UserInfo } from "src/interfaces/ITrustBonding.sol";
import { ISatelliteEmissionsController } from "src/interfaces/ISatelliteEmissionsController.sol";

import { VotingEscrow, LockedBalance } from "src/external/curve/VotingEscrow.sol";

/**
 * @title  TrustBonding
 * @author 0xIntuition
 * @notice Core contract of the Intuition protocol. This contract manages the locking of TRUST tokens
 *         and the distribution of inflationary rewards based on a time-weighted (bonded) balance known
 *         as veTRUST (vote-escrowed TRUST).
 *
 *         - "Locked" refers to the raw deposit of TRUST tokens into the contract.
 *         - "Bonded" (or veTRUST) is a time-weighted voting power derived from the locked tokens.
 *           It decays linearly over time, and uses the same formula as the Curve's veCRV.
 *         - Rewards for each epoch are allocated pro rata to users’ shares of the total bonded
 *           (veTRUST) balance at the end of that epoch.
 *         - Certain APR and emission formulas reference the raw locked balance rather than the
 *           bonded balance. For example, the maximum emission rate is determined by what percentage
 *           of the total TRUST supply has been locked.
 *         - Rewards for epoch `n` become claimable in epoch `n+1` and are forfeited if not claimed
 *           before the next epoch ends (i.e. only the previous epoch's rewards are claimable).
 *         - This version of the TrustBonding contract introduces the utilization-based rewards model,
 *           where the emitted rewards are based on the system utilizationRatio from the MultiVault
 *           contract, whereas the user's rewards are based on their own (personal) utilizationRatio.
 *         - utilizationRatio is defined as percentage of how much did the personal or system utilization
 *           change from epoch to epoch when compared to the target utilization, which represents the
 *           amount of TRUST tokens that were claimed as rewards in the previous epoch (on both the
 *           personal and the system level).
 *
 * @dev    Extended from the Solidity implementation of the Curve Finance's `VotingEscrow`
 *         contract (originally written in Vyper), as used by the Stargate Finance protocol:
 *         https://github.com/stargate-protocol/stargate-dao/blob/main/contracts/VotingEscrow.sol
 */
contract TrustBonding is ITrustBonding, PausableUpgradeable, VotingEscrow {
    /*//////////////////////////////////////////////////////////////
                                 CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Number of seconds in a year
    uint256 public constant YEAR = 365 days;

    /// @notice Basis points divisor used for calculations within the contract
    uint256 public constant BASIS_POINTS_DIVISOR = 10_000;

    /// @notice Minimum system utilization lower bound in basis points
    uint256 public constant MINIMUM_SYSTEM_UTILIZATION_LOWER_BOUND = 4000;

    /// @notice Minimum personal utilization lower bound in basis points
    uint256 public constant MINIMUM_PERSONAL_UTILIZATION_LOWER_BOUND = 2500;

    /// @notice Role used for pausing the contract
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /*//////////////////////////////////////////////////////////////
                                 STATE
    //////////////////////////////////////////////////////////////*/

    /// @notice Mapping of epochs to the total claimed rewards for that epoch among all users
    mapping(uint256 epoch => uint256 totalClaimedRewards) public totalClaimedRewardsForEpoch;

    /// @notice Mapping of users to their respective claimed rewards for a specific epoch
    mapping(address user => mapping(uint256 epoch => uint256 claimedRewards)) public userClaimedRewardsForEpoch;

    /// @notice The MultiVault contract address
    address public multiVault;

    /// @notice The SatelliteEmissionsController contract address
    address public satelliteEmissionsController;

    /// @notice The system utilization lower bound in basis points (represents the minimum possible system utilization
    /// ratio)
    uint256 public systemUtilizationLowerBound;

    /// @notice The personal utilization lower bound in basis points (represents the minimum possible personal
    /// utilization ratio)
    uint256 public personalUtilizationLowerBound;

    /// @notice The address of the Timelock contract that can update certain parameters
    address public timelock;

    /// @dev Gap for upgrade safety
    uint256[50] private __gap;

    /*//////////////////////////////////////////////////////////////
                                 MODIFIERS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Modifier to restrict access to functions to only the timelock address
     */
    modifier onlyTimelock() {
        if (msg.sender != timelock) {
            revert TrustBonding_OnlyTimelock();
        }
        _;
    }

    /*//////////////////////////////////////////////////////////////
                                 CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @inheritdoc ITrustBonding
    function initialize(
        address _owner,
        address _timelock,
        address _trustToken,
        uint256 _epochLength,
        address _satelliteEmissionsController,
        uint256 _systemUtilizationLowerBound,
        uint256 _personalUtilizationLowerBound
    )
        external
        initializer
    {
        if (_owner == address(0)) {
            revert TrustBonding_ZeroAddress();
        }

        __Pausable_init();
        __VotingEscrow_init(_owner, _trustToken, _epochLength);

        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(PAUSER_ROLE, _owner);

        _setTimelock(_timelock);
        _updateSatelliteEmissionsController(_satelliteEmissionsController);
        _updateSystemUtilizationLowerBound(_systemUtilizationLowerBound);
        _updatePersonalUtilizationLowerBound(_personalUtilizationLowerBound);
    }

    /*//////////////////////////////////////////////////////////////
                                 VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc ITrustBonding
    function epochLength() public view returns (uint256) {
        return ICoreEmissionsController(satelliteEmissionsController).getEpochLength();
    }

    /// @inheritdoc ITrustBonding
    function epochsPerYear() public view returns (uint256) {
        return _epochsPerYear();
    }

    /// @inheritdoc ITrustBonding
    function epochTimestampEnd(uint256 epoch) public view returns (uint256) {
        return _epochTimestampEnd(epoch);
    }

    /// @inheritdoc ITrustBonding
    function epochAtTimestamp(uint256 timestamp) public view returns (uint256) {
        return _epochAtTimestamp(timestamp);
    }

    /// @inheritdoc ITrustBonding
    function currentEpoch() public view returns (uint256) {
        return _currentEpoch();
    }

    /// @inheritdoc ITrustBonding
    function previousEpoch() public view returns (uint256) {
        return _previousEpoch();
    }

    /// @inheritdoc ITrustBonding
    function emissionsForEpoch(uint256 epoch) public view returns (uint256) {
        return _emissionsForEpoch(epoch);
    }

    /// @inheritdoc ITrustBonding
    function totalLocked() public view returns (uint256) {
        return supply;
    }

    /// @inheritdoc ITrustBonding
    function totalBondedBalance() external view returns (uint256) {
        return _totalSupply(block.timestamp);
    }

    /// @inheritdoc ITrustBonding
    function totalBondedBalanceAtEpochEnd(uint256 epoch) public view returns (uint256) {
        if (epoch > currentEpoch()) {
            revert TrustBonding_InvalidEpoch();
        }

        return _totalSupply(_epochTimestampEnd(epoch));
    }

    /// @inheritdoc ITrustBonding
    function userBondedBalanceAtEpochEnd(address account, uint256 epoch) public view returns (uint256) {
        if (account == address(0)) {
            revert TrustBonding_ZeroAddress();
        }

        if (epoch > currentEpoch()) {
            revert TrustBonding_InvalidEpoch();
        }

        return _balanceOf(account, _epochTimestampEnd(epoch));
    }

    /// @inheritdoc ITrustBonding
    function userEligibleRewardsForEpoch(address account, uint256 epoch) public view returns (uint256) {
        return _userEligibleRewardsForEpoch(account, epoch);
    }

    /// @inheritdoc ITrustBonding
    function hasClaimedRewardsForEpoch(address account, uint256 epoch) public view returns (bool) {
        return _hasClaimedRewardsForEpoch(account, epoch);
    }

    /// @inheritdoc ITrustBonding
    function getSystemUtilizationRatio(uint256 epoch) public view returns (uint256) {
        return _getSystemUtilizationRatio(epoch);
    }

    /// @inheritdoc ITrustBonding
    function getPersonalUtilizationRatio(address account, uint256 epoch) public view returns (uint256) {
        return _getPersonalUtilizationRatio(account, epoch);
    }

    function getUserInfo(address account) external view returns (UserInfo memory) {
        uint256 _currEpoch = _currentEpoch();
        uint256 userRewards;
        uint256 personalUtilization;

        if (_currEpoch > 0) {
            userRewards = _userEligibleRewardsForEpoch(account, _currEpoch);
            personalUtilization = _getPersonalUtilizationRatio(account, _currEpoch);
        }

        LockedBalance memory userLocked = locked[account];
        return UserInfo({
            personalUtilization: personalUtilization,
            eligibleRewards: (userRewards * personalUtilization) / BASIS_POINTS_DIVISOR,
            maxRewards: userRewards,
            lockedAmount: userLocked.amount >= 0 ? uint256(uint128(userLocked.amount)) : 0,
            lockEnd: userLocked.end,
            bondedBalance: _balanceOf(account, block.timestamp)
        });
    }

    /// @inheritdoc ITrustBonding
    function getUserApy(address account) external view returns (uint256 currentApy, uint256 maxApy) {
        uint256 currEpoch = _currentEpoch();
        uint256 userRewards = _userEligibleRewardsForEpoch(account, currEpoch);
        uint256 personalUtilization = _getPersonalUtilizationRatio(account, currEpoch);
        int256 locked = locked[account].amount;

        if (userRewards == 0 || locked <= 0) {
            return (currentApy, maxApy);
        }

        uint256 userRewardsPerYear = userRewards * _epochsPerYear();
        currentApy = (userRewardsPerYear * personalUtilization) / uint256(locked);
        maxApy = (userRewardsPerYear * BASIS_POINTS_DIVISOR) / uint256(locked);
        return (currentApy, maxApy);
    }

    /// @inheritdoc ITrustBonding
    function getUserCurrentClaimableRewards(address account) external view returns (uint256) {
        uint256 _currEpoch = _currentEpoch();

        if (_currEpoch == 0) {
            return 0;
        }

        uint256 prevEpoch = _currEpoch - 1;
        uint256 userClaimedReward = userClaimedRewardsForEpoch[account][prevEpoch];
        uint256 userEligibleReward = _userEligibleRewardsForEpoch(account, prevEpoch)
            * _getPersonalUtilizationRatio(account, prevEpoch) / BASIS_POINTS_DIVISOR;

        if (userEligibleReward <= userClaimedReward) {
            return 0;
        }

        return userEligibleReward - userClaimedReward;
    }

    /// @inheritdoc ITrustBonding
    function getUserRewardsForEpoch(address account, uint256 epoch) external view returns (uint256, uint256) {
        uint256 _currEpoch = _currentEpoch();
        if (_currEpoch == 0 || epoch > _currEpoch) {
            return (0, 0);
        }
        uint256 userRewards = _userEligibleRewardsForEpoch(account, epoch);
        uint256 personalUtilization = _getPersonalUtilizationRatio(account, epoch);
        return ((userRewards * personalUtilization) / BASIS_POINTS_DIVISOR, userRewards);
    }

    /// @inheritdoc ITrustBonding
    function getSystemApy() external view returns (uint256 currentApy, uint256 maxApy) {
        uint256 _supply = _totalSupply(block.timestamp);
        if (_supply == 0) {
            return (0, 0);
        }
        uint256 _currEpoch = _currentEpoch();
        uint256 emissionsPerYear = _emissionsForEpoch(_currEpoch) * _epochsPerYear();
        uint256 maxEmissions = ICoreEmissionsController(satelliteEmissionsController).getEmissionsAtEpoch(_currEpoch);
        uint256 maxEmissionsPerYear = maxEmissions * _epochsPerYear();
        currentApy = (emissionsPerYear * BASIS_POINTS_DIVISOR) / _supply;
        maxApy = (maxEmissionsPerYear * BASIS_POINTS_DIVISOR) / _supply;
        return (currentApy, maxApy);
    }

    /// @inheritdoc ITrustBonding
    function getUnclaimedRewardsForEpoch(uint256 epoch) external view returns (uint256) {
        uint256 currentEpochLocal = currentEpoch();

        // There cannot be any unclaimed rewards during the first two epochs, so we return 0.
        if (currentEpochLocal < 2) {
            return 0;
        }

        // We only want unclaimed rewards from epochs that are no longer claimable.
        // For epochs that are still claimable, we return 0.
        // This means we only consider epochs that are at least two epochs old.
        if (epoch > currentEpochLocal - 2) {
            return 0;
        }

        // Reclaiming of unclaimed rewards is based on the amount of rewards allocated for a given epoch
        // (i.e. `maxEpochEmissions`), and not the system utilization-adjusted rewards.
        uint256 epochRewards = ICoreEmissionsController(satelliteEmissionsController).getEmissionsAtEpoch(epoch);
        uint256 claimedRewards = totalClaimedRewardsForEpoch[epoch];

        return epochRewards - claimedRewards;
    }

    /*//////////////////////////////////////////////////////////////
                            USER ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc ITrustBonding
    function claimRewards(address recipient) external whenNotPaused nonReentrant {
        if (recipient == address(0)) {
            revert TrustBonding_ZeroAddress();
        }

        uint256 currentEpochLocal = currentEpoch();

        // No rewards can be claimed during the first epoch
        if (currentEpochLocal == 0) {
            revert TrustBonding_NoClaimingDuringFirstEpoch();
        }

        // Fetch the raw (pro-rata) rewards for the previous epoch
        uint256 prevEpoch = currentEpochLocal - 1;
        uint256 rawUserRewards = _userEligibleRewardsForEpoch(msg.sender, prevEpoch);

        // Check if the user has any rewards to claim
        if (rawUserRewards == 0) {
            revert TrustBonding_NoRewardsToClaim();
        }

        // Apply the personal utilization ratio to the raw rewards
        uint256 personalUtilizationRatio = _getPersonalUtilizationRatio(msg.sender, prevEpoch);
        uint256 userRewards = rawUserRewards * personalUtilizationRatio / BASIS_POINTS_DIVISOR;

        // Check if the user has any rewards to claim after applying the personal utilization ratio.
        // This check is here mostly to prevent claiming 0 rewards in case the lower bound for the
        // personal utilization ratio is set to 0.
        if (userRewards == 0) {
            revert TrustBonding_NoRewardsToClaim();
        }

        // Check if the user has already claimed rewards for the previous epoch
        if (_hasClaimedRewardsForEpoch(msg.sender, prevEpoch)) {
            revert TrustBonding_RewardsAlreadyClaimedForEpoch();
        }

        // Increment the total claimed inflationary rewards for the previous epoch and set the user's claimed rewards
        totalClaimedRewardsForEpoch[prevEpoch] += userRewards;
        userClaimedRewardsForEpoch[msg.sender][prevEpoch] = userRewards;

        // Mint the rewards to the recipient address
        ISatelliteEmissionsController(satelliteEmissionsController).transfer(recipient, userRewards);

        emit RewardsClaimed(msg.sender, recipient, userRewards);
    }

    /*//////////////////////////////////////////////////////////////
                         ACCESS-RESTRICTED FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc ITrustBonding
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @inheritdoc ITrustBonding
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @inheritdoc ITrustBonding
    function setMultiVault(address _multiVault) external onlyTimelock {
        _setMultiVault(_multiVault);
    }

    /// @inheritdoc ITrustBonding
    function setTimelock(address _timelock) external onlyTimelock {
        _setTimelock(_timelock);
    }

    /// @inheritdoc ITrustBonding
    function updateSatelliteEmissionsController(address _satelliteEmissionsController) external onlyTimelock {
        _updateSatelliteEmissionsController(_satelliteEmissionsController);
    }

    /// @inheritdoc ITrustBonding
    function updateSystemUtilizationLowerBound(uint256 newLowerBound) external onlyTimelock {
        _updateSystemUtilizationLowerBound(newLowerBound);
    }

    /// @inheritdoc ITrustBonding
    function updatePersonalUtilizationLowerBound(uint256 newLowerBound) external onlyTimelock {
        _updatePersonalUtilizationLowerBound(newLowerBound);
    }

    /*//////////////////////////////////////////////////////////////
                            INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _currentEpoch() internal view returns (uint256) {
        return _epochAtTimestamp(block.timestamp);
    }

    function _epochsPerYear() internal view returns (uint256) {
        return YEAR / ICoreEmissionsController(satelliteEmissionsController).getEpochLength();
    }

    function _epochTimestampEnd(uint256 epoch) internal view returns (uint256) {
        return ICoreEmissionsController(satelliteEmissionsController).getEpochTimestampEnd(epoch);
    }

    function _epochAtTimestamp(uint256 timestamp) internal view returns (uint256) {
        return ICoreEmissionsController(satelliteEmissionsController).getEpochAtTimestamp(timestamp);
    }

    function _emissionsForEpoch(uint256 epoch) internal view returns (uint256) {
        if (epoch > currentEpoch()) {
            revert TrustBonding_InvalidEpoch();
        }

        uint256 maxEpochEmissions = ICoreEmissionsController(satelliteEmissionsController).getEmissionsAtEpoch(epoch);

        if (epoch < 2) {
            return maxEpochEmissions;
        }

        uint256 systemUtilizationRatio = _getSystemUtilizationRatio(epoch);
        uint256 epochEmissions = maxEpochEmissions * systemUtilizationRatio / BASIS_POINTS_DIVISOR;

        return epochEmissions;
    }

    function _hasClaimedRewardsForEpoch(address account, uint256 epoch) internal view returns (bool) {
        return userClaimedRewardsForEpoch[account][epoch] > 0;
    }

    function _userEligibleRewardsForEpoch(address account, uint256 epoch) internal view returns (uint256) {
        if (account == address(0)) {
            revert TrustBonding_ZeroAddress();
        }

        if (epoch > currentEpoch()) {
            revert TrustBonding_InvalidEpoch();
        }

        uint256 userBalance = userBondedBalanceAtEpochEnd(account, epoch);
        uint256 totalBalance = totalBondedBalanceAtEpochEnd(epoch);

        if (userBalance == 0 || totalBalance == 0) {
            return 0;
        }

        return userBalance * _emissionsForEpoch(epoch) / totalBalance;
    }

    function _getPersonalUtilizationRatio(address _account, uint256 _epoch) internal view returns (uint256) {
        if (_account == address(0)) {
            revert TrustBonding_ZeroAddress();
        }

        // If the epoch is in the future, return 0 and exit early
        if (_epoch > currentEpoch()) {
            return 0;
        }

        // In epochs 0 and 1, the utilization ratio is set to the maximum value (100%)
        if (_epoch < 2) {
            return BASIS_POINTS_DIVISOR;
        }

        int256 userUtilizationBefore = IMultiVault(multiVault).getUserUtilizationInEpoch(_account, _epoch - 1);
        int256 userUtilizationAfter = IMultiVault(multiVault).getUserUtilizationInEpoch(_account, _epoch);

        // Since rawUtilizationDelta is signed, we only do a sign check, as the explicit underflow check is not needed
        int256 rawUtilizationDelta = userUtilizationAfter - userUtilizationBefore;

        // If the utilizationDelta is negative or zero, we return the minimum personal utilization ratio
        if (rawUtilizationDelta <= 0) {
            return personalUtilizationLowerBound;
        }

        // Since we previously ensured that userUtilizationDelta > 0, we can now safely cast it to uint256
        uint256 userUtilizationDelta = uint256(rawUtilizationDelta);

        // Fetch the target utilization for the previous epoch
        uint256 userUtilizationTarget = userClaimedRewardsForEpoch[_account][_epoch - 1];

        if (userUtilizationTarget == 0) {
            // If the user had nothing claimable last epoch, don't penalize them as it's their first ever claim
            if (_userEligibleRewardsForEpoch(_account, _epoch - 1) == 0) {
                return BASIS_POINTS_DIVISOR; // 100%
            }

            // They did have eligibility last epoch but chose not to claim --> give them only the floor allocation
            return personalUtilizationLowerBound;
        }

        // If the userUtilizationDelta is greater than the target, we also return the max ratio.
        if (userUtilizationDelta >= userUtilizationTarget) {
            return BASIS_POINTS_DIVISOR; // 100%
        }

        // Normalize the final utilizationRatio to be within the bounds of the personalUtilizationLowerBound and
        // BASIS_POINTS_DIVISOR
        return
            _getNormalizedUtilizationRatio(userUtilizationDelta, userUtilizationTarget, personalUtilizationLowerBound);
    }

    function _getSystemUtilizationRatio(uint256 _epoch) internal view returns (uint256) {
        // If the epoch is in the future, return 0 and exit early
        if (_epoch > currentEpoch()) {
            return 0;
        }

        // In epochs 0 and 1, the utilization ratio is set to the maximum value (100%)
        if (_epoch < 2) {
            return BASIS_POINTS_DIVISOR;
        }

        // Fetch the system utilization before and after the epoch
        int256 utilizationBefore = IMultiVault(multiVault).getTotalUtilizationForEpoch(_epoch - 1);
        int256 utilizationAfter = IMultiVault(multiVault).getTotalUtilizationForEpoch(_epoch);

        // Since rawUtilizationDelta is signed, we only do a sign check, as the explicit underflow check is not needed
        int256 rawUtilizationDelta = utilizationAfter - utilizationBefore;

        // If the utilizationDelta is negative or zero, we return the minimum system utilization ratio
        if (rawUtilizationDelta <= 0) {
            return systemUtilizationLowerBound;
        }

        // Since we previously ensured that utilizationDelta > 0, we can now safely cast it to uint256
        uint256 utilizationDelta = uint256(rawUtilizationDelta);

        // Fetch the target utilization for the previous epoch
        uint256 utilizationTarget = totalClaimedRewardsForEpoch[_epoch - 1];

        // If the utilizationDelta is greater than the target, we return the max ratio
        if (utilizationDelta >= utilizationTarget) {
            return BASIS_POINTS_DIVISOR;
        }

        // Normalize the final utilizationRatio to be within the bounds of the systemUtilizationLowerBound and
        // BASIS_POINTS_DIVISOR
        return _getNormalizedUtilizationRatio(utilizationDelta, utilizationTarget, systemUtilizationLowerBound);
    }

    /**
     * @notice Returns the normalized utilization ratio, adjusted for the desired range (lowerBound,
     * BASIS_POINTS_DIVISOR)
     * @param delta The change in utilization from the previous epoch
     * @param target The target utilization for the previous epoch
     * @param lowerBound The lower bound for the utilization ratio
     * @return The normalized utilization ratio for the given parameters
     */
    function _getNormalizedUtilizationRatio(
        uint256 delta,
        uint256 target,
        uint256 lowerBound
    )
        internal
        pure
        returns (uint256)
    {
        uint256 ratioRange = BASIS_POINTS_DIVISOR - lowerBound;
        uint256 utilizationRatio = lowerBound + (delta * ratioRange) / target;
        return utilizationRatio;
    }

    function _setTimelock(address _timelock) internal {
        if (_timelock == address(0)) {
            revert TrustBonding_ZeroAddress();
        }
        timelock = _timelock;
        emit TimelockSet(_timelock);
    }

    function _setMultiVault(address newMultiVault) internal {
        if (newMultiVault == address(0)) {
            revert TrustBonding_ZeroAddress();
        }
        multiVault = newMultiVault;
        emit MultiVaultSet(newMultiVault);
    }

    function _updateSatelliteEmissionsController(address newSatelliteEmissionsController) internal {
        if (newSatelliteEmissionsController == address(0)) {
            revert TrustBonding_ZeroAddress();
        }
        satelliteEmissionsController = newSatelliteEmissionsController;
        emit SatelliteEmissionsControllerSet(newSatelliteEmissionsController);
    }

    function _updateSystemUtilizationLowerBound(uint256 newLowerBound) internal {
        if (newLowerBound > BASIS_POINTS_DIVISOR || newLowerBound < MINIMUM_SYSTEM_UTILIZATION_LOWER_BOUND) {
            revert TrustBonding_InvalidUtilizationLowerBound();
        }

        systemUtilizationLowerBound = newLowerBound;

        emit SystemUtilizationLowerBoundUpdated(newLowerBound);
    }

    function _updatePersonalUtilizationLowerBound(uint256 newLowerBound) internal {
        if (newLowerBound > BASIS_POINTS_DIVISOR || newLowerBound < MINIMUM_PERSONAL_UTILIZATION_LOWER_BOUND) {
            revert TrustBonding_InvalidUtilizationLowerBound();
        }

        personalUtilizationLowerBound = newLowerBound;

        emit PersonalUtilizationLowerBoundUpdated(newLowerBound);
    }

    function _previousEpoch() internal view returns (uint256) {
        uint256 curr = _currentEpoch();
        return curr == 0 ? 0 : curr - 1;
    }
}


// --- src/protocol/emissions/CoreEmissionsController.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

import { FixedPointMathLib } from "solady/utils/FixedPointMathLib.sol";
import { ICoreEmissionsController } from "src/interfaces/ICoreEmissionsController.sol";

contract CoreEmissionsController is ICoreEmissionsController {
    using FixedPointMathLib for uint256;

    /* =================================================== */
    /*                     CONSTANTS                       */
    /* =================================================== */

    /// @dev Divisor for basis point calculations (100% = 10,000 basis points)
    uint256 internal constant BASIS_POINTS_DIVISOR = 10_000;

    /// @dev Maximum allowed cliff reduction in basis points (10% = 1000 basis points)
    uint256 internal constant MAX_CLIFF_REDUCTION_BASIS_POINTS = 1000;

    /* =================================================== */
    /*                        STORAGE                      */
    /* =================================================== */

    /// @dev Timestamp when emissions schedule begins
    uint256 internal _START_TIMESTAMP;

    /// @dev Duration of each epoch in seconds
    uint256 internal _EPOCH_LENGTH;

    /// @dev Base amount of TRUST tokens emitted per epoch
    uint256 internal _EMISSIONS_PER_EPOCH;

    /// @dev Number of epochs between emissions reductions
    uint256 internal _EMISSIONS_REDUCTION_CLIFF;

    /// @dev Factor used to calculate retained emissions after reduction (10000 - reduction_basis_points)
    uint256 internal _EMISSIONS_RETENTION_FACTOR;

    /// @dev Gap for upgrade safety
    uint256[50] private __gap;

    /* =================================================== */
    /*                 INITIALIZATION                      */
    /* =================================================== */

    function __CoreEmissionsController_init(
        uint256 startTimestamp,
        uint256 emissionsLength,
        uint256 emissionsPerEpoch,
        uint256 emissionsReductionCliff,
        uint256 emissionsReductionBasisPoints
    )
        internal
    {
        _validateTimestampStart(startTimestamp);
        _validateEmissionsPerEpoch(emissionsPerEpoch);
        _validateCliff(emissionsReductionCliff);
        _validateReductionBasisPoints(emissionsReductionBasisPoints);

        _START_TIMESTAMP = startTimestamp;
        _EPOCH_LENGTH = emissionsLength;
        _EMISSIONS_PER_EPOCH = emissionsPerEpoch;
        _EMISSIONS_REDUCTION_CLIFF = emissionsReductionCliff;
        _EMISSIONS_RETENTION_FACTOR = BASIS_POINTS_DIVISOR - emissionsReductionBasisPoints;

        emit Initialized(
            startTimestamp, emissionsLength, emissionsPerEpoch, emissionsReductionCliff, emissionsReductionBasisPoints
        );
    }

    /* =================================================== */
    /*                      GETTERS                        */
    /* =================================================== */

    /// @inheritdoc ICoreEmissionsController
    function getStartTimestamp() external view returns (uint256) {
        return _START_TIMESTAMP;
    }

    /// @inheritdoc ICoreEmissionsController
    function getEpochLength() external view returns (uint256) {
        return _EPOCH_LENGTH;
    }

    /// @inheritdoc ICoreEmissionsController
    function getCurrentEpoch() external view returns (uint256) {
        return _currentEpoch();
    }

    /// @inheritdoc ICoreEmissionsController
    function getEpochAtTimestamp(uint256 timestamp) external view returns (uint256) {
        return _calculateTotalEpochsToTimestamp(timestamp);
    }

    /// @inheritdoc ICoreEmissionsController
    function getEpochTimestampStart(uint256 epochNumber) external view returns (uint256) {
        return _calculateEpochTimestampStart(epochNumber);
    }

    /// @inheritdoc ICoreEmissionsController
    function getEpochTimestampEnd(uint256 epochNumber) external view returns (uint256) {
        return _calculateEpochTimestampEnd(epochNumber);
    }

    /// @inheritdoc ICoreEmissionsController
    function getCurrentEpochTimestampStart() external view returns (uint256) {
        uint256 currentEpoch = _currentEpoch();
        return _calculateEpochTimestampStart(currentEpoch);
    }

    /// @inheritdoc ICoreEmissionsController
    function getEmissionsAtEpoch(uint256 epochNumber) external view returns (uint256) {
        return _emissionsAtEpoch(epochNumber);
    }

    /// @inheritdoc ICoreEmissionsController
    function getEmissionsAtTimestamp(uint256 timestamp) external view returns (uint256) {
        return _calculateEpochEmissionsAt(timestamp);
    }

    /// @inheritdoc ICoreEmissionsController
    function getCurrentEpochEmissions() external view returns (uint256) {
        return _calculateEpochEmissionsAt(block.timestamp);
    }

    /* =================================================== */
    /*                   VALIDATION                        */
    /* =================================================== */

    function _validateEmissionsPerEpoch(uint256 emissionsPerEpoch) internal pure {
        if (emissionsPerEpoch == 0) {
            revert CoreEmissionsController_InvalidEmissionsPerEpoch();
        }
    }

    function _validateTimestampStart(uint256 timestampStart) internal view {
        if (timestampStart < block.timestamp) {
            revert CoreEmissionsController_InvalidTimestampStart();
        }
    }

    function _validateReductionBasisPoints(uint256 emissionsReductionBasisPoints) internal pure {
        if (emissionsReductionBasisPoints > MAX_CLIFF_REDUCTION_BASIS_POINTS) {
            revert CoreEmissionsController_InvalidReductionBasisPoints();
        }
    }

    function _validateCliff(uint256 emissionsReductionCliff) internal pure {
        if (emissionsReductionCliff == 0 || emissionsReductionCliff > 365) {
            revert CoreEmissionsController_InvalidCliff();
        }
    }

    /* =================================================== */
    /*                 INTERNAL FUNCTIONS                  */
    /* =================================================== */

    function _emissionsAtEpoch(uint256 epoch) internal view returns (uint256) {
        // Calculate how many complete cliff periods have passed
        uint256 cliffsPassed = epoch / _EMISSIONS_REDUCTION_CLIFF;

        // Apply cliff reductions to base emissions
        return _applyCliffReductions(_EMISSIONS_PER_EPOCH, _EMISSIONS_RETENTION_FACTOR, cliffsPassed);
    }

    function _currentEpoch() internal view returns (uint256) {
        if (block.timestamp < _START_TIMESTAMP) {
            return 0;
        }

        return _calculateTotalEpochsToTimestamp(block.timestamp);
    }

    function _calculateEpochTimestampStart(uint256 epoch) internal view returns (uint256) {
        return _START_TIMESTAMP + (epoch * _EPOCH_LENGTH);
    }

    function _calculateEpochTimestampEnd(uint256 epoch) internal view returns (uint256) {
        return _START_TIMESTAMP + (epoch * _EPOCH_LENGTH) + _EPOCH_LENGTH;
    }

    /**
     * @notice Calculate epoch emissions for any given timestamp
     * @param timestamp The timestamp to calculate emissions for
     * @return Emissions amount for the epoch containing the timestamp
     */
    function _calculateEpochEmissionsAt(uint256 timestamp) internal view returns (uint256) {
        if (timestamp < _START_TIMESTAMP) {
            return 0;
        }

        // Calculate current epoch number
        uint256 currentEpochNumber = _calculateTotalEpochsToTimestamp(timestamp);

        // Calculate how many complete cliff periods have passed
        uint256 cliffsPassed = currentEpochNumber / _EMISSIONS_REDUCTION_CLIFF;

        // Apply cliff reductions to base emissions
        return _applyCliffReductions(_EMISSIONS_PER_EPOCH, _EMISSIONS_RETENTION_FACTOR, cliffsPassed);
    }

    /**
     * @notice Calculate total epochs that have passed up to a given timestamp
     * @param timestamp The timestamp to calculate epochs for
     * @return Total number of complete epochs that have passed since start
     */
    function _calculateTotalEpochsToTimestamp(uint256 timestamp) internal view returns (uint256) {
        if (timestamp < _START_TIMESTAMP) {
            return 0;
        }

        return (timestamp - _START_TIMESTAMP) / _EPOCH_LENGTH;
    }

    /**
     * @notice Apply compound cliff reductions to base emissions
     * @param baseEmissions Starting emissions amount per epoch
     * @param retentionFactor Retention factor (10000 - reductionBasisPoints)
     * @param cliffsToApply Number of cliff reductions to apply
     * @return Final emissions after all cliff reductions
     */
    function _applyCliffReductions(
        uint256 baseEmissions,
        uint256 retentionFactor,
        uint256 cliffsToApply
    )
        internal
        pure
        returns (uint256)
    {
        if (cliffsToApply == 0) return baseEmissions;

        // Convert retentionFactor to WAD (1e18) ratio
        uint256 rWad = (retentionFactor * 1e18) / BASIS_POINTS_DIVISOR;

        // factorWad = rWad^cliffs (scaled by 1e18) - O(log n) time complexity thanks to FixedPointMathLib
        uint256 factorWad = FixedPointMathLib.rpow(rWad, cliffsToApply, 1e18);

        // baseEmissions * factorWad / 1e18
        return FixedPointMathLib.mulWad(baseEmissions, factorWad);
    }
}


// --- src/protocol/emissions/MetaERC20Dispatcher.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

import { FinalityState, IMetaERC20HubOrSpoke, IMetalayerRouter, IIGP } from "src/interfaces/IMetaLayer.sol";

contract MetaERC20Dispatcher {
    /* =================================================== */
    /*                       CONSTANTS                     */
    /* =================================================== */
    uint256 public constant GAS_CONSTANT = 100_000;

    /* =================================================== */
    /*                  INTERNAL STATE                     */
    /* =================================================== */

    uint32 internal _recipientDomain;
    address internal _metaERC20SpokeOrHub;
    FinalityState internal _finalityState;
    uint256 internal _messageGasCost;

    /// @dev Gap for upgrade safety
    uint256[50] private __gap;

    /* =================================================== */
    /*                      EVENTS                         */
    /* =================================================== */

    event FinalityStateUpdated(FinalityState newFinalityState);

    event MessageGasCostUpdated(uint256 newMessageGasCost);

    event RecipientDomainUpdated(uint32 newRecipientDomain);

    event MetaERC20SpokeOrHubUpdated(address newMetaERC20SpokeOrHub);

    /* =================================================== */
    /*                      ERRORS                         */
    /* =================================================== */

    error MetaERC20Dispatcher_InvalidAddress();

    /* =================================================== */
    /*                    INITIALIZER                      */
    /* =================================================== */

    function __MetaERC20Dispatcher_init(
        address metaERC20SpokeOrHub,
        uint32 recipientDomain,
        uint256 gasCost,
        FinalityState finalityState
    )
        internal
    {
        // Initialize MetaERC20Dispatcher
        _setMetaERC20SpokeOrHub(metaERC20SpokeOrHub);
        _setRecipientDomain(recipientDomain);
        _setMessageGasCost(gasCost);
        _setFinalityState(finalityState);
    }

    /* =================================================== */
    /*                      GETTERS                        */
    /* =================================================== */

    function getRecipientDomain() external view returns (uint32) {
        return _recipientDomain;
    }

    function getMetaERC20SpokeOrHub() external view returns (address) {
        return _metaERC20SpokeOrHub;
    }

    function getFinalityState() external view returns (FinalityState) {
        return _finalityState;
    }

    function getMessageGasCost() external view returns (uint256) {
        return _messageGasCost;
    }

    function quoteGasPayment(uint32 domain, uint256 gasLimit) external view returns (uint256) {
        return _quoteGasPayment(domain, gasLimit);
    }

    /* =================================================== */
    /*                 INTERNAL FUNCTIONS                  */
    /* =================================================== */

    function _setMessageGasCost(uint256 newGasCost) internal {
        _messageGasCost = newGasCost;
        emit MessageGasCostUpdated(newGasCost);
    }

    function _setFinalityState(FinalityState newFinalityState) internal {
        _finalityState = newFinalityState;
        emit FinalityStateUpdated(newFinalityState);
    }

    function _setRecipientDomain(uint32 newDomain) internal {
        _recipientDomain = newDomain;
        emit RecipientDomainUpdated(newDomain);
    }

    function _setMetaERC20SpokeOrHub(address newMetaERC20SpokeOrHub) internal {
        if (newMetaERC20SpokeOrHub == address(0)) {
            revert MetaERC20Dispatcher_InvalidAddress();
        }
        _metaERC20SpokeOrHub = newMetaERC20SpokeOrHub;
        emit MetaERC20SpokeOrHubUpdated(newMetaERC20SpokeOrHub);
    }

    function _quoteGasPayment(uint32 domain, uint256 gasLimit) internal view returns (uint256) {
        IIGP igp = IIGP(IMetalayerRouter(IMetaERC20HubOrSpoke(_metaERC20SpokeOrHub).metalayerRouter()).igp());
        return igp.quoteGasPayment(domain, gasLimit);
    }

    function _bridgeTokensViaERC20(
        address _hubOrSpoke,
        uint32 _domain,
        bytes32 _recipient,
        uint256 _amount,
        uint256 _gasLimit,
        FinalityState _finality
    )
        internal
    {
        IMetaERC20HubOrSpoke(_hubOrSpoke).transferRemote{ value: _gasLimit }(
            _domain, _recipient, _amount, GAS_CONSTANT, _finality
        );
    }

    /**
     * @notice Bridges tokens to a destination chain using a specific Arbitrum precompile responsible for minting and
     * burning a chains native gas token.
     * @dev
     * https://github.com/OffchainLabs/nitro/blob/8f4fec5e7cd2ed856f8ea42490271989659ea695/precompiles/ArbNativeTokenManager.go#L28-L57
     * @dev
     * https://github.com/OffchainLabs/nitro-precompile-interfaces/blob/fe4121240ca1ee2cbf07d67d0e6c38015d94e704/ArbNativeTokenManager.sol
     */
    function _bridgeTokensViaNativeToken(
        address _hubOrSpoke,
        uint32 _domain,
        bytes32 _recipient,
        uint256 _amount,
        uint256 _gasLimit,
        FinalityState _finality
    )
        internal
    {
        // When bridging using a native token the `value` must include the `_gasLimit` and `amount` before being
        // sent to the MetaERC20HubOrSpoke smart contract. Only the amount is burned and the `gasLimit` is used to pay
        // for the
        // cross-chain message.
        IMetaERC20HubOrSpoke(_hubOrSpoke).transferRemote{ value: _gasLimit + _amount }(
            _domain, _recipient, _amount, GAS_CONSTANT, _finality
        );
    }
}


// --- src/protocol/emissions/SatelliteEmissionsController.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import { ISatelliteEmissionsController } from "src/interfaces/ISatelliteEmissionsController.sol";
import { ITrustBonding } from "src/interfaces/ITrustBonding.sol";
import { MetaERC20DispatchInit } from "src/interfaces/IMetaLayer.sol";
import { CoreEmissionsControllerInit } from "src/interfaces/ICoreEmissionsController.sol";
import { CoreEmissionsController } from "src/protocol/emissions/CoreEmissionsController.sol";
import { FinalityState, MetaERC20Dispatcher } from "src/protocol/emissions/MetaERC20Dispatcher.sol";

/**
 * @title  SatelliteEmissionsController
 * @author 0xIntuition
 * @notice Controls the transfers of TRUST tokens from the TrustBonding contract.
 */
contract SatelliteEmissionsController is
    ISatelliteEmissionsController,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    CoreEmissionsController,
    MetaERC20Dispatcher
{
    /* =================================================== */
    /*                     CONSTANTS                       */
    /* =================================================== */

    bytes32 public constant CONTROLLER_ROLE = keccak256("CONTROLLER_ROLE");

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /* =================================================== */
    /*                  INTERNAL STATE                     */
    /* =================================================== */

    /// @notice Address of the TrustBonding contract
    address internal _TRUST_BONDING;

    /// @notice Address of the BaseEmissionsController contract
    address internal _BASE_EMISSIONS_CONTROLLER;

    /// @notice Mapping of reclaimed emissions for each epoch
    mapping(uint256 epoch => uint256 amount) internal _reclaimedEmissions;

    /// @dev Gap for upgrade safety
    uint256[50] private __gap;

    /* =================================================== */
    /*                    CONSTRUCTOR                      */
    /* =================================================== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address admin,
        address baseEmissionsController,
        MetaERC20DispatchInit memory metaERC20DispatchInit,
        CoreEmissionsControllerInit memory checkpointInit
    )
        external
        initializer
    {
        if (admin == address(0)) {
            revert SatelliteEmissionsController_InvalidAddress();
        }

        // Initialize the AccessControl and ReentrancyGuard contracts
        __AccessControl_init();
        __ReentrancyGuard_init();

        __CoreEmissionsController_init(
            checkpointInit.startTimestamp,
            checkpointInit.emissionsLength,
            checkpointInit.emissionsPerEpoch,
            checkpointInit.emissionsReductionCliff,
            checkpointInit.emissionsReductionBasisPoints
        );

        __MetaERC20Dispatcher_init(
            metaERC20DispatchInit.hubOrSpoke,
            metaERC20DispatchInit.recipientDomain,
            metaERC20DispatchInit.gasLimit,
            metaERC20DispatchInit.finalityState
        );

        // Initialize access control
        _grantRole(DEFAULT_ADMIN_ROLE, admin);

        // Set BaseEmissionsController contract address
        _setBaseEmissionsController(baseEmissionsController);
    }

    /* =================================================== */
    /*                      GETTERS                        */
    /* =================================================== */

    /// @inheritdoc ISatelliteEmissionsController
    function getTrustBonding() external view returns (address) {
        return _TRUST_BONDING;
    }

    /// @inheritdoc ISatelliteEmissionsController
    function getBaseEmissionsController() external view returns (address) {
        return _BASE_EMISSIONS_CONTROLLER;
    }

    /// @inheritdoc ISatelliteEmissionsController
    function getReclaimedEmissions(uint256 epoch) external view returns (uint256) {
        return _reclaimedEmissions[epoch];
    }

    /* =================================================== */
    /*                      RECEIVE                        */
    /* =================================================== */

    /**
     * @notice The SatelliteEmissionsController will receive TRUST tokens from the BaseEmissionsController and hold
     * those tokens until a user claims their rewards or until they are bridged back to the BaseEmissionsController to
     * be burned.
     */
    receive() external payable { }

    /* =================================================== */
    /*                    CONTROLLER                       */
    /* =================================================== */

    /// @inheritdoc ISatelliteEmissionsController
    function transfer(address recipient, uint256 amount) external nonReentrant onlyRole(CONTROLLER_ROLE) {
        if (recipient == address(0)) revert SatelliteEmissionsController_InvalidAddress();
        if (amount == 0) revert SatelliteEmissionsController_InvalidAmount();
        if (address(this).balance < amount) revert SatelliteEmissionsController_InsufficientBalance();

        Address.sendValue(payable(recipient), amount);

        emit NativeTokenTransferred(recipient, amount);
    }

    /* =================================================== */
    /*                       ADMIN                         */
    /* =================================================== */

    /// @inheritdoc ISatelliteEmissionsController
    function setTrustBonding(address newTrustBonding) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setTrustBonding(newTrustBonding);
    }

    /// @inheritdoc ISatelliteEmissionsController
    function setBaseEmissionsController(address newBaseEmissionsController) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setBaseEmissionsController(newBaseEmissionsController);
    }

    /// @inheritdoc ISatelliteEmissionsController
    function setMessageGasCost(uint256 newGasCost) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setMessageGasCost(newGasCost);
    }

    /// @inheritdoc ISatelliteEmissionsController
    function setFinalityState(FinalityState newFinalityState) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setFinalityState(newFinalityState);
    }

    /// @inheritdoc ISatelliteEmissionsController
    function setMetaERC20SpokeOrHub(address newMetaERC20SpokeOrHub) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setMetaERC20SpokeOrHub(newMetaERC20SpokeOrHub);
    }

    /// @inheritdoc ISatelliteEmissionsController
    function setRecipientDomain(uint32 newRecipientDomain) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setRecipientDomain(newRecipientDomain);
    }

    /// @inheritdoc ISatelliteEmissionsController
    function withdrawUnclaimedEmissions(
        uint256 epoch,
        address recipient
    )
        external
        nonReentrant
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (_TRUST_BONDING == address(0)) {
            revert SatelliteEmissionsController_TrustBondingNotSet();
        }

        // Prevent withdrawing zero amount if no unclaimed emissions are available.
        uint256 amount = ITrustBonding(_TRUST_BONDING).getUnclaimedRewardsForEpoch(epoch);
        if (amount == 0) {
            revert SatelliteEmissionsController_InvalidWithdrawAmount();
        }

        if (recipient == address(0)) {
            revert SatelliteEmissionsController_InvalidAddress();
        }

        // Check if emissions for this epoch have already been reclaimed.
        if (_reclaimedEmissions[epoch] > 0) {
            revert SatelliteEmissionsController_PreviouslyBridgedUnclaimedEmissions();
        }

        // Mark the unclaimed emissions as reclaimed and prevent from being claimed again.
        _reclaimedEmissions[epoch] = amount;

        // Transfer the unclaimed emissions to the recipient.
        Address.sendValue(payable(recipient), amount);

        emit UnclaimedEmissionsWithdrawn(epoch, recipient, amount);
    }

    /// @inheritdoc ISatelliteEmissionsController
    function bridgeUnclaimedEmissions(uint256 epoch) external payable onlyRole(OPERATOR_ROLE) {
        if (_TRUST_BONDING == address(0)) {
            revert SatelliteEmissionsController_TrustBondingNotSet();
        }

        // Prevent bridging of zero amount if no unclaimed rewards are available.
        uint256 amount = ITrustBonding(_TRUST_BONDING).getUnclaimedRewardsForEpoch(epoch);
        if (amount == 0) {
            revert SatelliteEmissionsController_InvalidBridgeAmount();
        }

        // Check if emissions for this epoch have already been reclaimed and bridged.
        if (_reclaimedEmissions[epoch] > 0) {
            revert SatelliteEmissionsController_PreviouslyBridgedUnclaimedEmissions();
        }

        // Mark the unclaimed emissions as bridged and prevent from being claimed and bridged again.
        _reclaimedEmissions[epoch] = amount;

        // Calculate gas limit for the bridge transfer using the MetaLayer router.
        uint256 gasLimit = _quoteGasPayment(_recipientDomain, GAS_CONSTANT + _messageGasCost);
        if (msg.value < gasLimit) {
            revert SatelliteEmissionsController_InsufficientGasPayment();
        }

        // Bridge the unclaimed emissions back to the base emissions controller.
        // Reference the MetaERC20Dispatcher smart contract for more details.
        _bridgeTokensViaNativeToken(
            _metaERC20SpokeOrHub,
            _recipientDomain,
            bytes32(uint256(uint160(_BASE_EMISSIONS_CONTROLLER))),
            amount,
            gasLimit,
            _finalityState
        );

        if (msg.value > gasLimit) {
            Address.sendValue(payable(msg.sender), msg.value - gasLimit);
        }

        emit UnclaimedEmissionsBridged(epoch, amount);
    }

    /* =================================================== */
    /*                 INTERNAL FUNCTIONS                  */
    /* =================================================== */

    function _setTrustBonding(address newTrustBonding) internal {
        if (newTrustBonding == address(0)) {
            revert SatelliteEmissionsController_InvalidAddress();
        }
        _TRUST_BONDING = newTrustBonding;
        emit TrustBondingUpdated(newTrustBonding);
    }

    function _setBaseEmissionsController(address newBaseEmissionsController) internal {
        if (newBaseEmissionsController == address(0)) {
            revert SatelliteEmissionsController_InvalidAddress();
        }
        _BASE_EMISSIONS_CONTROLLER = newBaseEmissionsController;
        emit BaseEmissionsControllerUpdated(newBaseEmissionsController);
    }
}


// --- src/protocol/wallet/AtomWalletFactory.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

import { BeaconProxy } from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import { IEntryPoint } from "@account-abstraction/interfaces/IEntryPoint.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import { AtomWallet } from "src/protocol/wallet/AtomWallet.sol";
import { IAtomWalletFactory } from "src/interfaces/IAtomWalletFactory.sol";
import { IMultiVault } from "src/interfaces/IMultiVault.sol";
import { IMultiVaultCore } from "src/interfaces/IMultiVaultCore.sol";

/**
 * @title AtomWalletFactory
 * @author 0xIntuition
 * @notice Factory contract for deploying AtomWallets (ERC-4337 accounts) using the BeaconProxy pattern.
 */
contract AtomWalletFactory is IAtomWalletFactory, Initializable {
    /* =================================================== */
    /*                      ERRORS                         */
    /* =================================================== */

    error AtomWalletFactory_ZeroAddress();
    error AtomWalletFactory_DeployAtomWalletFailed();
    error AtomWalletFactory_TermDoesNotExist();
    error AtomWalletFactory_TermNotAtom();

    /* =================================================== */
    /*                  STATE VARIABLES                    */
    /* =================================================== */

    /// @notice The MultiVault contract
    address public multiVault;

    /// @dev Gap for upgrade safety
    uint256[50] private __gap;

    /* =================================================== */
    /*                    CONSTRUCTOR                      */
    /* =================================================== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /* =================================================== */
    /*                    INITIALIZER                      */
    /* =================================================== */

    /**
     * @notice Initializes the AtomWalletFactory contract
     * @param _multiVault The address of the MultiVault contract
     */
    function initialize(address _multiVault) external initializer {
        if (_multiVault == address(0)) {
            revert AtomWalletFactory_ZeroAddress();
        }

        multiVault = _multiVault;
    }

    /* =================================================== */
    /*                    WRITE FUNCTIONS                  */
    /* =================================================== */

    /**
     * @notice Deploys an AtomWallet for a given atom ID
     * @dev Deploys an ERC-4337 account (atom wallet) through a BeaconProxy or returns the existing
     *      one if already deployed
     * @param atomId id of atom
     * @return atomWallet the address of the atom wallet
     */
    function deployAtomWallet(bytes32 atomId) external returns (address) {
        if (!IMultiVault(multiVault).isTermCreated(atomId)) {
            revert AtomWalletFactory_TermDoesNotExist();
        }

        if (IMultiVaultCore(multiVault).isTriple(atomId)) {
            revert AtomWalletFactory_TermNotAtom();
        }

        // get contract deployment data
        bytes memory data = _getDeploymentData(atomId);

        address predictedAtomWalletAddress = computeAtomWalletAddr(atomId);

        uint256 codeLengthBefore = predictedAtomWalletAddress.code.length;

        // if wallet is already deployed, return its address
        if (codeLengthBefore != 0) {
            return predictedAtomWalletAddress;
        }

        address deployedAtomWalletAddress;

        // deploy atom wallet with create2:
        // value sent in wei,
        // memory offset of `code` (after first 32 bytes where the length is),
        // length of `code` (first 32 bytes of code),
        // salt for create2
        assembly {
            deployedAtomWalletAddress := create2(0, add(data, 0x20), mload(data), atomId)
        }

        if (deployedAtomWalletAddress == address(0)) {
            revert AtomWalletFactory_DeployAtomWalletFailed();
        }

        emit AtomWalletDeployed(atomId, deployedAtomWalletAddress);

        return deployedAtomWalletAddress;
    }

    /* =================================================== */
    /*                    VIEW FUNCTIONS                   */
    /* =================================================== */

    /**
     * @notice Returns the AtomWallet address for the given atom data
     * @dev The create2 salt is based off of the vault ID
     * @param atomId id of the atom associated to the atom wallet
     * @return atomWallet the address of the atom wallet
     */
    function computeAtomWalletAddr(bytes32 atomId) public view returns (address) {
        // get contract deployment data
        bytes memory data = _getDeploymentData(atomId);

        // compute the raw contract address
        bytes32 rawAddress = keccak256(abi.encodePacked(bytes1(0xff), address(this), atomId, keccak256(data)));

        return address(bytes20(rawAddress << 96));
    }

    /* =================================================== */
    /*                    INTERNAL HELPERS                 */
    /* =================================================== */

    /**
     * @dev Returns the deployment data for the new AtomWallet contract
     * @param atomId the term ID of the atom wallet
     * @return bytes memory the deployment data for the AtomWallet contract (using BeaconProxy pattern)
     */
    function _getDeploymentData(bytes32 atomId) internal view returns (bytes memory) {
        // Addresses of the atomWalletBeacon and entryPoint contracts
        (address entryPoint,, address atomWalletBeacon,) = IMultiVaultCore(multiVault).walletConfig();

        // BeaconProxy creation code
        bytes memory code = type(BeaconProxy).creationCode;

        // encode the init function of the AtomWallet contract with the correct initialization arguments
        bytes memory initData = abi.encodeWithSelector(
            AtomWallet.initialize.selector, IEntryPoint(entryPoint), address(multiVault), atomId
        );

        // encode constructor arguments of the BeaconProxy contract (address beacon, bytes memory data)
        bytes memory encodedArgs = abi.encode(atomWalletBeacon, initData);

        // concatenate the BeaconProxy creation code with the ABI-encoded constructor arguments
        return abi.encodePacked(code, encodedArgs);
    }
}


// --- src/protocol/wallet/AtomWarden.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";

import { IAtomWarden } from "src/interfaces/IAtomWarden.sol";
import { IAtomWallet } from "src/interfaces/IAtomWallet.sol";
import { IMultiVault } from "src/interfaces/IMultiVault.sol";
import { IMultiVaultCore } from "src/interfaces/IMultiVaultCore.sol";

/**
 * @title  AtomWarden
 * @author 0xIntuition
 * @notice A utility contract of the Intuition protocol. It acts as an initial owner of all newly
 *         created atom wallets, and it also allows users to automatically claim ownership over
 *         the atom wallets for which they've proven ownership over.
 */
contract AtomWarden is IAtomWarden, Initializable, Ownable2StepUpgradeable {
    /* =================================================== */
    /*                      STATE                          */
    /* =================================================== */

    /// @notice The reference to the MultiVault contract addressC
    address public multiVault;

    /* =================================================== */
    /*                      CONSTRUCTOR                    */
    /* =================================================== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /* =================================================== */
    /*                      INITIALIZER                    */
    /* =================================================== */

    /**
     * @notice Initializes the AtomWarden contract
     * @param admin The address of the admin
     * @param _multiVault MultiVault contract address
     */
    function initialize(address admin, address _multiVault) external initializer {
        __Ownable_init(admin);
        _setMultiVault(_multiVault);
    }

    /* =================================================== */
    /*                   USER FUNCTIONS                    */
    /* =================================================== */

    /// @inheritdoc IAtomWarden
    function claimOwnershipOverAddressAtom(bytes32 atomId) external {
        // validate atomId refers to an existing atom
        if (!IMultiVaultCore(multiVault).isAtom(atomId)) {
            revert AtomWarden_AtomIdDoesNotExist();
        }

        // stored atom data must equal lowercase string address
        bytes memory storedAtomData = IMultiVaultCore(multiVault).atom(atomId);
        bytes memory expectedAtomData = abi.encodePacked(_toLowerCaseAddress(msg.sender));

        if (keccak256(storedAtomData) != keccak256(expectedAtomData)) {
            revert AtomWarden_ClaimOwnershipFailed();
        }

        address payable atomWalletAddress = payable(IMultiVault(multiVault).computeAtomWalletAddr(atomId));

        if (atomWalletAddress.code.length == 0) {
            revert AtomWarden_AtomWalletNotDeployed();
        }
        IAtomWallet(atomWalletAddress).transferOwnership(msg.sender);

        emit AtomWalletOwnershipClaimed(atomId, msg.sender);
    }

    /* =================================================== */
    /*                      ADMIN FUNCTIONS                */
    /* =================================================== */

    /// @inheritdoc IAtomWarden
    function claimOwnership(bytes32 atomId, address newOwner) external onlyOwner {
        if (newOwner == address(0)) {
            revert AtomWarden_InvalidNewOwnerAddress();
        }

        // validate the vault exists and is an atom
        if (!IMultiVaultCore(multiVault).isAtom(atomId)) {
            revert AtomWarden_AtomIdDoesNotExist();
        }

        address payable atomWalletAddress = payable(IMultiVault(multiVault).computeAtomWalletAddr(atomId));

        if (atomWalletAddress.code.length == 0) {
            revert AtomWarden_AtomWalletNotDeployed();
        }
        IAtomWallet(atomWalletAddress).transferOwnership(newOwner);

        emit AtomWalletOwnershipClaimed(atomId, newOwner);
    }

    /// @inheritdoc IAtomWarden
    function setMultiVault(address _multiVault) external onlyOwner {
        _setMultiVault(_multiVault);
    }

    /* =================================================== */
    /*                   INTERNAL FUNCTIONS                */
    /* =================================================== */

    /**
     * @notice Converts an address to its lowercase hexadecimal string representation.
     * @param _address The address to be converted.
     * @return The lowercase hexadecimal string of the address.
     */
    function _toLowerCaseAddress(address _address) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef"; // Lowercase hexadecimal characters
        bytes20 addrBytes = bytes20(_address);
        bytes memory str = new bytes(42);

        str[0] = "0";
        str[1] = "x";

        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(addrBytes[i] >> 4)]; // Upper 4 bits (first hex character)
            str[3 + i * 2] = alphabet[uint8(addrBytes[i] & 0x0f)]; // Lower 4 bits (second hex character)
        }

        return string(str);
    }

    function _setMultiVault(address _multiVault) internal {
        if (address(_multiVault) == address(0)) {
            revert AtomWarden_InvalidAddress();
        }

        multiVault = _multiVault;

        emit MultiVaultSet(_multiVault);
    }
}


// --- src/protocol/wallet/AtomWallet.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

import { BaseAccount } from "@account-abstraction/core/BaseAccount.sol";
import { PackedUserOperation } from "@account-abstraction/interfaces/PackedUserOperation.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { IEntryPoint } from "@account-abstraction/interfaces/IEntryPoint.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

import { IMultiVault } from "src/interfaces/IMultiVault.sol";

// For SIG_VALIDATION_FAILED
import "@account-abstraction/core/Helpers.sol";

/**
 * @title  AtomWallet
 * @author 0xIntuition
 * @notice Core contract of the Intuition protocol. This contract is an abstract account
 *         associated with a corresponding atom.
 */
contract AtomWallet is Initializable, BaseAccount, Ownable2StepUpgradeable, ReentrancyGuardUpgradeable {
    using ECDSA for bytes32;

    /* =================================================== */
    /*                      ERRORS                         */
    /* =================================================== */

    error AtomWallet_OnlyOwnerOrEntryPoint();
    error AtomWallet_ZeroAddress();
    error AtomWallet_WrongArrayLengths();
    error AtomWallet_OnlyOwner();
    error AtomWallet_InvalidSignatureLength(uint256 length);
    error AtomWallet_InvalidSignatureS(bytes32 s);

    /* =================================================== */
    /*                  CONSTANTS                          */
    /* =================================================== */

    /**
     * @notice The storage slot for the AtomWallet owner
     * @dev Corresponds to the keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.Ownable")) - 1)) &
     * ~bytes32(uint256(0xff))
     */
    bytes32 private constant AtomWalletOwnerStorageLocation =
        0x9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199300;

    /**
     * @notice The storage slot for the AtomWallet pending owner
     * @dev Corresponds to the keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.Ownable2Step")) - 1)) &
     * ~bytes32(uint256(0xff))
     */
    bytes32 private constant AtomWalletPendingOwnerStorageLocation =
        0x237e158222e3e6968b72b9db0d8043aacf074ad9f650f0d1606b4d82ee432c00;

    /* =================================================== */
    /*                  STATE VARIABLES                    */
    /* =================================================== */

    /// @notice The MultiVault contract address
    IMultiVault public multiVault;

    /// @notice The entry point contract address
    IEntryPoint private _entryPoint;

    /// @notice The flag to indicate if the wallet's ownership has been claimed by the user
    bool public isClaimed;

    /// @notice The term ID of the atom associated with this wallet
    bytes32 public termId;

    /// @dev Gap for upgrade safety
    uint256[50] private __gap;

    /* =================================================== */
    /*                    MODIFIERS                        */
    /* =================================================== */

    /// @dev Modifier to allow only the owner or entry point to call a function
    modifier onlyOwnerOrEntryPoint() {
        if (!(msg.sender == address(entryPoint()) || msg.sender == owner())) {
            revert AtomWallet_OnlyOwnerOrEntryPoint();
        }
        _;
    }

    /* =================================================== */
    /*                    CONSTRUCTOR                      */
    /* =================================================== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /* =================================================== */
    /*                    INITIALIZER                      */
    /* =================================================== */

    /**
     * @notice Initialize the AtomWallet contract
     * @param anEntryPoint the EntryPoint contract address
     * @param _multiVault the MultiVault contract address
     * @param _termId the term ID of the atom associated with this wallet
     */
    function initialize(address anEntryPoint, address _multiVault, bytes32 _termId) external initializer {
        if (anEntryPoint == address(0)) {
            revert AtomWallet_ZeroAddress();
        }

        if (_multiVault == address(0)) {
            revert AtomWallet_ZeroAddress();
        }

        __Ownable_init(IMultiVault(_multiVault).getAtomWarden());
        __ReentrancyGuard_init();

        _entryPoint = IEntryPoint(anEntryPoint);
        multiVault = IMultiVault(_multiVault);
        termId = _termId;
    }

    /* =================================================== */
    /*                     RECEIVE                         */
    /* =================================================== */

    /// @notice Receive function to accept native TRUST transfers
    receive() external payable { }

    /* =================================================== */
    /*                MUTATIVE FUNCTIONS                   */
    /* =================================================== */

    /**
     * @notice Execute a transaction (called directly from owner, or by entryPoint)
     * @param dest the target address
     * @param value the value to send
     * @param data the function calldata
     */
    function execute(
        address dest,
        uint256 value,
        bytes calldata data
    )
        external
        override
        onlyOwnerOrEntryPoint
        nonReentrant
    {
        _call(dest, value, data);
    }

    /**
     * @notice Execute a sequence (batch) of transactions
     * @param dest the target addresses array
     * @param values the values to send array
     * @param data the function calldata array
     */
    function executeBatch(
        address[] calldata dest,
        uint256[] calldata values,
        bytes[] calldata data
    )
        external
        payable
        onlyOwnerOrEntryPoint
        nonReentrant
    {
        uint256 length = dest.length;

        if (length != values.length || values.length != data.length) {
            revert AtomWallet_WrongArrayLengths();
        }

        for (uint256 i = 0; i < length;) {
            _call(dest[i], values[i], data[i]);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Add deposit to the account in the entry point contract
    function addDeposit() external payable {
        entryPoint().depositTo{ value: msg.value }(address(this));
    }

    /**
     * @notice Withdraws value from the account's deposit
     * @param withdrawAddress target to send to
     * @param amount to withdraw
     */
    function withdrawDepositTo(address payable withdrawAddress, uint256 amount) external {
        if (!(msg.sender == owner() || msg.sender == address(this))) {
            revert AtomWallet_OnlyOwner();
        }
        entryPoint().withdrawTo(withdrawAddress, amount);
    }

    /**
     * @notice Initiates the ownership transfer over the wallet to a new owner
     * @dev Overrides the transferOwnership function of Ownable2StepUpgradeable
     * @param newOwner the new owner of the wallet (becomes the pending owner)
     */
    function transferOwnership(address newOwner) public override onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }

        Ownable2StepStorage storage $ = _getAtomWalletPendingOwnerStorage();
        $._pendingOwner = newOwner;

        emit OwnershipTransferStarted(owner(), newOwner);
    }

    /**
     * @notice The new owner accepts the ownership over the wallet. If the wallet's ownership
     *         is being accepted by the user, the wallet is considered claimed. Once claimed,
     *         the wallet is considered owned by the user and this action cannot be undone.
     * @dev Overrides the acceptOwnership function of Ownable2StepUpgradeable
     */
    function acceptOwnership() public override {
        address sender = msg.sender;

        if (pendingOwner() != sender) {
            revert OwnableUnauthorizedAccount(sender);
        }

        if (!isClaimed) {
            isClaimed = true;
        }

        super._transferOwnership(sender);
    }

    /**
     * @notice Claims the accumulated fees from the MultiVault contract to the AtomWallet owner
     * @dev Can only be called by the owner
     */
    function claimAtomWalletDepositFees() external onlyOwner nonReentrant {
        multiVault.claimAtomWalletDepositFees(termId);
    }

    /* =================================================== */
    /*                    VIEW FUNCTIONS                   */
    /* =================================================== */

    /// @notice Returns the deposit of the account in the entry point contract
    function getDeposit() external view returns (uint256) {
        return entryPoint().balanceOf(address(this));
    }

    /**
     * @notice Get the entry point contract address
     * @dev Overrides the entryPoint function of BaseAccount
     * @return the entry point contract address
     */
    function entryPoint() public view virtual override returns (IEntryPoint) {
        return _entryPoint;
    }

    /**
     * @notice Returns the owner of the wallet. If the wallet has been claimed, the owner
     *         is the user. Otherwise, the owner is the atomWarden.
     * @dev Overrides the owner function of OwnableUpgradeable
     * @return the owner of the wallet
     */
    function owner() public view override returns (address) {
        OwnableStorage storage $ = _getAtomWalletOwnerStorage();
        return isClaimed ? $._owner : multiVault.getAtomWarden();
    }

    /* =================================================== */
    /*                    INTERNAL FUNCTIONS               */
    /* =================================================== */

    /**
     * @notice Validate the signature of the user operation
     * @dev Implements the template method of BaseAccount
     * @param userOp the user operation
     * @param userOpHash the hash of the user operation
     * @return validationData the validation data (0 if successful)
     */
    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    )
        internal
        virtual
        override
        returns (uint256 validationData)
    {
        (uint48 validUntil, uint48 validAfter, bytes memory signature) =
            _extractValidUntilAndValidAfterFromSignature(userOp.signature);

        bytes32 hash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", userOpHash));

        (address recovered, ECDSA.RecoverError recoverError, bytes32 errorArg) = ECDSA.tryRecover(hash, signature);

        if (recoverError == ECDSA.RecoverError.InvalidSignatureLength) {
            revert AtomWallet_InvalidSignatureLength(uint256(errorArg));
        } else if (recoverError == ECDSA.RecoverError.InvalidSignatureS) {
            revert AtomWallet_InvalidSignatureS(errorArg);
        } else if (recoverError == ECDSA.RecoverError.InvalidSignature) {
            return _packValidationData(true, validUntil, validAfter);
        }

        bool sigFailed = recovered != owner();
        return _packValidationData(sigFailed, validUntil, validAfter);
    }

    /**
     * @notice An internal method that calls a target address with value and data
     * @param target the target address
     * @param value the value to send
     * @param data the function calldata
     */
    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{ value: value }(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    /**
     * @notice Extracts validUntil and validAfter from a signature suffix and returns the raw signature
     * @dev Signature format: abi.encodePacked(r, s, v) or abi.encodePacked(r, s, v, uint48 validUntil, uint48
     *      validAfter)
     * @param signature the full signature bytes
     * @return validUntil the valid until timestamp (0 means no expiry)
     * @return validAfter the valid after timestamp
     * @return rawSignature the 65-byte ECDSA signature (r,s,v)
     */
    function _extractValidUntilAndValidAfterFromSignature(bytes calldata signature)
        internal
        pure
        returns (uint48 validUntil, uint48 validAfter, bytes memory rawSignature)
    {
        uint256 signatureLength = signature.length;
        if (signatureLength == 65) {
            return (0, 0, signature);
        }
        if (signatureLength != 77) {
            revert AtomWallet_InvalidSignatureLength(signatureLength);
        }

        uint256 metaOffset = signatureLength - 12;
        rawSignature = signature[:metaOffset];

        bytes memory meta = signature[metaOffset:];
        uint256 word;
        assembly {
            word := mload(add(meta, 32))
        }
        uint96 packed = uint96(word >> 160);
        validUntil = uint48(packed >> 48);
        validAfter = uint48(packed);
    }

    /**
     * @dev Get the storage slot for the AtomWallet contract owner
     * @return $ the storage slot
     */
    function _getAtomWalletOwnerStorage() private pure returns (OwnableStorage storage $) {
        assembly {
            $.slot := AtomWalletOwnerStorageLocation
        }
    }

    /**
     * @dev Get the storage slot for the AtomWallet contract pending owner
     * @return $ the storage slot
     */
    function _getAtomWalletPendingOwnerStorage() private pure returns (Ownable2StepStorage storage $) {
        assembly {
            $.slot := AtomWalletPendingOwnerStorageLocation
        }
    }
}


// --- src/protocol/curves/LinearCurve.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

import { FixedPointMathLib } from "solady/utils/FixedPointMathLib.sol";

import { BaseCurve } from "src/protocol/curves/BaseCurve.sol";

/**
 * @title  LinearCurve
 * @author 0xIntuition
 * @notice A bonding curve model where share value increases linearly through pro-rata
 *         fee accumulation rather than supply-based pricing. Collected fees are distributed
 *         proportionally to holders, enabling steady, predictable value growth for
 *         low-volatility scenarios.
 */
contract LinearCurve is BaseCurve {
    using FixedPointMathLib for uint256;

    /* =================================================== */
    /*                     CONSTANTS                       */
    /* =================================================== */

    /// @dev Maximum number of shares that can be handled by the curve
    uint256 public constant MAX_SHARES = type(uint256).max;

    /// @dev Maximum number of assets that can be handled by the curve
    uint256 public constant MAX_ASSETS = type(uint256).max;

    /// @dev Represents one share in 18 decimal format
    uint256 public constant ONE_SHARE = 1e18;

    /* =================================================== */
    /*                    CONSTRUCTOR                      */
    /* =================================================== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /* =================================================== */
    /*                    INITIALIZER                      */
    /* =================================================== */

    /// @notice Initializes a new LinearCurve
    /// @param _name The name of the curve
    function initialize(string calldata _name) external initializer {
        __BaseCurve_init(_name);
    }

    /* =================================================== */
    /*                   BASECURVE FUNCTIONS               */
    /* =================================================== */

    /// @inheritdoc BaseCurve
    function maxShares() external pure override returns (uint256) {
        return MAX_SHARES;
    }

    /// @inheritdoc BaseCurve
    function maxAssets() external pure override returns (uint256) {
        return MAX_ASSETS;
    }

    /// @inheritdoc BaseCurve
    function previewDeposit(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares
    )
        external
        pure
        override
        returns (uint256 shares)
    {
        _checkCurveDomains(totalAssets, totalShares, MAX_ASSETS, MAX_SHARES);
        _checkDepositBounds(assets, totalAssets, MAX_ASSETS);
        shares = _convertToShares(assets, totalAssets, totalShares);
        _checkDepositOut(shares, totalShares, MAX_SHARES);
    }

    /// @inheritdoc BaseCurve
    function previewRedeem(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets
    )
        external
        pure
        override
        returns (uint256 assets)
    {
        _checkCurveDomains(totalAssets, totalShares, MAX_ASSETS, MAX_SHARES);
        _checkRedeem(shares, totalShares);
        assets = _convertToAssets(shares, totalShares, totalAssets);
    }

    /// @inheritdoc BaseCurve
    function previewMint(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets
    )
        external
        pure
        override
        returns (uint256 assets)
    {
        _checkCurveDomains(totalAssets, totalShares, MAX_ASSETS, MAX_SHARES);
        _checkMintBounds(shares, totalShares, MAX_SHARES);
        assets = totalShares == 0 ? shares : shares.fullMulDivUp(totalAssets, totalShares);
        _checkMintOut(assets, totalAssets, MAX_ASSETS);
    }

    /// @inheritdoc BaseCurve
    function previewWithdraw(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares
    )
        external
        pure
        override
        returns (uint256 shares)
    {
        _checkCurveDomains(totalAssets, totalShares, MAX_ASSETS, MAX_SHARES);
        _checkWithdraw(assets, totalAssets);
        shares = totalShares == 0 ? assets : assets.fullMulDivUp(totalShares, totalAssets);
    }

    /// @inheritdoc BaseCurve
    function convertToShares(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares
    )
        external
        pure
        override
        returns (uint256 shares)
    {
        _checkCurveDomains(totalAssets, totalShares, MAX_ASSETS, MAX_SHARES);
        _checkDepositBounds(assets, totalAssets, MAX_ASSETS);
        shares = _convertToShares(assets, totalAssets, totalShares);
        _checkDepositOut(shares, totalShares, MAX_SHARES);
    }

    /// @inheritdoc BaseCurve
    function convertToAssets(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets
    )
        external
        pure
        override
        returns (uint256 assets)
    {
        _checkCurveDomains(totalAssets, totalShares, MAX_ASSETS, MAX_SHARES);
        _checkRedeem(shares, totalShares);
        assets = _convertToAssets(shares, totalShares, totalAssets);
    }

    /// @inheritdoc BaseCurve
    function currentPrice(uint256 totalShares, uint256 totalAssets)
        external
        pure
        override
        returns (uint256 sharePrice)
    {
        _checkCurveDomains(totalAssets, totalShares, MAX_ASSETS, MAX_SHARES);
        return _convertToAssets(ONE_SHARE, totalShares, totalAssets);
    }

    /* =================================================== */
    /*                    INTERNAL FUNCTIONS               */
    /* =================================================== */

    /// @dev Internal function to convert assets to shares without checks
    function _convertToShares(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares
    )
        internal
        pure
        returns (uint256 shares)
    {
        uint256 supply = totalShares;
        shares = supply == 0 ? assets : assets.fullMulDiv(supply, totalAssets);
    }

    /// @dev Internal function to convert shares to assets without checks
    function _convertToAssets(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets
    )
        internal
        pure
        returns (uint256 assets)
    {
        uint256 supply = totalShares;
        assets = supply == 0 ? shares : shares.fullMulDiv(totalAssets, supply);
    }
}


// --- src/protocol/curves/BaseCurve.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import { IBaseCurve } from "src/interfaces/IBaseCurve.sol";

/**
 * @title  BaseCurve
 * @author 0xIntuition
 * @notice Abstract contract for a bonding curve. Defines the interface for converting assets to shares and vice versa.
 * @dev This contract is designed to be inherited by other bonding curve contracts, providing a common interface for
 *      converting between assets and shares.
 * @dev These curves handle the pure mathematical relationship for share price. Pool ratio adjustments (such as
 *      accommodating for the effect of fees, supply burn, airdrops, etc) are handled by the MultiVault instead
 *      of the curves themselves.
 */
abstract contract BaseCurve is IBaseCurve, Initializable {
    /* =================================================== */
    /*                  STATE VARIABLES                    */
    /* =================================================== */

    /// @notice The name of the curve
    string public name;

    /* =================================================== */
    /*                    CONSTRUCTOR                      */
    /* =================================================== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /* =================================================== */
    /*                    INITIALIZER                      */
    /* =================================================== */

    /// @notice Initialize the curve with a unique name
    /// @param _name Unique name for the curve
    function __BaseCurve_init(string memory _name) internal onlyInitializing {
        if (bytes(_name).length == 0) {
            revert BaseCurve_EmptyStringNotAllowed();
        }

        name = _name;

        emit CurveNameSet(_name);
    }

    /* =================================================== */
    /*                    EXTERNAL FUNCTIONS               */
    /* =================================================== */

    /// @notice The maximum number of shares that this curve can handle without overflowing.
    /// @dev Checked by the MultiVault before transacting
    function maxShares() external view virtual returns (uint256);

    /// @notice The maximum number of assets that this curve can handle without overflowing.
    /// @dev Checked by the MultiVault before transacting
    function maxAssets() external view virtual returns (uint256);

    /// @notice Preview how many shares would be minted for a deposit of assets
    /// @dev Rounding direction of previewDeposit is always down
    /// @param assets Quantity of assets to deposit
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @return shares The number of shares that would be minted
    function previewDeposit(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares
    )
        external
        view
        virtual
        returns (uint256 shares);

    /// @notice Preview how many assets would be required to mint a specific amount of shares
    /// @dev Rounding direction of previewMint is always up
    /// @param shares Quantity of shares to mint
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @return assets The number of assets that would be required to mint the shares
    function previewMint(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets
    )
        external
        view
        virtual
        returns (uint256 assets);

    /// @notice Preview how many shares would be redeemed for a withdrawal of assets
    /// @dev Rounding direction of previewWithdraw is always up
    /// @param assets Quantity of assets to withdraw
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @return shares The number of shares that would need to be redeemed
    function previewWithdraw(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares
    )
        external
        view
        virtual
        returns (uint256 shares);

    /// @notice Preview how many assets would be returned for burning a specific amount of shares
    /// @dev Rounding direction of previewRedeem is always down
    /// @param shares Quantity of shares to burn
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @return assets The number of assets that would be returned
    function previewRedeem(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets
    )
        external
        view
        virtual
        returns (uint256 assets);

    /// @notice Convert assets to shares at a specific point on the curve
    /// @dev Rounding direction of convertToShares is always down
    /// @param assets Quantity of assets to convert to shares
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @return shares The number of shares equivalent to the given assets
    function convertToShares(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares
    )
        external
        view
        virtual
        returns (uint256 shares);

    /// @notice Convert shares to assets at a specific point on the curve
    /// @dev Rounding direction of convertToAssets is always down
    /// @param shares Quantity of shares to convert to assets
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @return assets The number of assets equivalent to the given shares
    function convertToAssets(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets
    )
        external
        view
        virtual
        returns (uint256 assets);

    /// @notice Get the current price of a share
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @return sharePrice The current price of a share, scaled by 1e18
    function currentPrice(uint256 totalShares, uint256 totalAssets) external view virtual returns (uint256 sharePrice);

    /* =================================================== */
    /*                  INTERNAL FUNCTIONS                 */
    /* =================================================== */

    // previewWithdraw(): assets <= totalAssets
    function _checkWithdraw(uint256 assets, uint256 totalAssets) internal pure {
        if (assets > totalAssets) revert BaseCurve_AssetsExceedTotalAssets();
    }

    // previewRedeem()/convertToAssets(): shares <= totalShares
    function _checkRedeem(uint256 shares, uint256 totalShares) internal pure {
        if (shares > totalShares) revert BaseCurve_SharesExceedTotalShares();
    }

    /// @dev previewDeposit()/convertToShares(): assets + totalAssets <= maxAssets
    function _checkDepositBounds(uint256 assets, uint256 totalAssets, uint256 maxAssetsCap) internal pure {
        // Use subtraction to avoid potential overflow on (assets + totalAssets)
        if (assets > maxAssetsCap - totalAssets) revert BaseCurve_AssetsOverflowMax();
    }

    /// @dev previewDeposit()/convertToShares(): (sharesOut) + totalShares <= maxShares
    function _checkDepositOut(uint256 sharesOut, uint256 totalShares, uint256 maxSharesCap) internal pure {
        if (sharesOut > maxSharesCap - totalShares) revert BaseCurve_SharesOverflowMax();
    }

    /// @dev previewMint(): shares + totalShares <= maxShares
    function _checkMintBounds(uint256 shares, uint256 totalShares, uint256 maxSharesCap) internal pure {
        if (shares > maxSharesCap - totalShares) revert BaseCurve_SharesOverflowMax();
    }

    /// @dev previewMint(): (assetsOut) + totalAssets <= maxAssets
    function _checkMintOut(uint256 assetsOut, uint256 totalAssets, uint256 maxAssetsCap) internal pure {
        if (assetsOut > maxAssetsCap - totalAssets) revert BaseCurve_AssetsOverflowMax();
    }

    /// @dev Internal helper used to ensure that totalAssets and totalShares do not exceed curve limits
    function _checkCurveDomains(
        uint256 totalAssets,
        uint256 totalShares,
        uint256 maxAssetsCap,
        uint256 maxSharesCap
    )
        internal
        pure
    {
        if (totalAssets > maxAssetsCap || totalShares > maxSharesCap) revert BaseCurve_DomainExceeded();
    }
}


// --- src/protocol/curves/ProgressiveCurve.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

import { UD60x18, wrap, unwrap, add, sub, mul, div, sqrt, uUNIT, uMAX_UD60x18 } from "@prb/math/src/UD60x18.sol";

import { BaseCurve } from "src/protocol/curves/BaseCurve.sol";
import { ProgressiveCurveMathLib as PCMath } from "src/libraries/ProgressiveCurveMathLib.sol";

/**
 * @title  ProgressiveCurve
 * @author 0xIntuition
 * @notice A bonding curve implementation that uses a progressive pricing model where
 *         each new share costs more than the last.
 */
contract ProgressiveCurve is BaseCurve {
    /* =================================================== */
    /*                     STATE                           */
    /* =================================================== */

    /// @notice The slope of the curve (18 decimal fixed-point multiplier). This is the rate at which the price of
    /// shares increases
    UD60x18 public SLOPE;

    /// @notice The half of the slope, used for calculations
    UD60x18 public HALF_SLOPE;

    /// @dev The maximum shares are sqrt(uint256.max / 1e18) to prevent overflow in calculations
    uint256 public MAX_SHARES;

    /// @dev The maximum assets are derived from the maximum shares and slope to prevent overflow in calculations
    uint256 public MAX_ASSETS;

    /* =================================================== */
    /*                     ERRORS                          */
    /* =================================================== */

    /// @notice Custom errors
    error ProgressiveCurve_InvalidSlope();

    /* =================================================== */
    /*                    CONSTRUCTOR                      */
    /* =================================================== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /* =================================================== */
    /*                    INITIALIZER                      */
    /* =================================================== */

    /// @notice Initializes a new ProgressiveCurve with the given name and slope
    /// @dev Computes maximum values given constructor arguments
    /// @param _name The name of the curve
    /// @param slope18 The slope of the curve, in 18 decimal fixed-point format
    function initialize(string calldata _name, uint256 slope18) external initializer {
        __BaseCurve_init(_name);

        if (slope18 == 0 || slope18 % 2 != 0) revert ProgressiveCurve_InvalidSlope();

        SLOPE = wrap(slope18);
        HALF_SLOPE = wrap(slope18 / 2);

        UD60x18 maxSharesUD = sqrt(wrap(uMAX_UD60x18 / uUNIT));
        UD60x18 maxAssetsUD = mul(PCMath.square(maxSharesUD), HALF_SLOPE);

        MAX_SHARES = unwrap(maxSharesUD);
        MAX_ASSETS = unwrap(maxAssetsUD);
    }

    /* =================================================== */
    /*                   BASECURVE FUNCTIONS               */
    /* =================================================== */

    /// @inheritdoc BaseCurve
    function maxShares() external view override returns (uint256) {
        return MAX_SHARES;
    }

    /// @inheritdoc BaseCurve
    function maxAssets() external view override returns (uint256) {
        return MAX_ASSETS;
    }

    /// @inheritdoc BaseCurve
    function previewDeposit(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares
    )
        external
        view
        override
        returns (uint256 shares)
    {
        shares = _convertToShares(assets, totalAssets, totalShares);
    }

    /// @inheritdoc BaseCurve
    function previewRedeem(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets
    )
        external
        view
        override
        returns (uint256 assets)
    {
        assets = _convertToAssets(shares, totalShares, totalAssets);
    }

    /// @inheritdoc BaseCurve
    function previewMint(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets
    )
        external
        view
        override
        returns (uint256 assets)
    {
        _checkCurveDomains(totalAssets, totalShares, MAX_ASSETS, MAX_SHARES);
        _checkMintBounds(shares, totalShares, MAX_SHARES);

        UD60x18 s = wrap(totalShares);
        UD60x18 sNext = add(s, wrap(shares));

        UD60x18 area = sub(PCMath.squareUp(sNext), (PCMath.square(s)));
        UD60x18 assetsUD = PCMath.mulUp(area, HALF_SLOPE);
        assets = unwrap(assetsUD);

        _checkMintOut(assets, totalAssets, MAX_ASSETS);
    }

    /// @inheritdoc BaseCurve
    function previewWithdraw(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares
    )
        external
        view
        override
        returns (uint256 shares)
    {
        _checkCurveDomains(totalAssets, totalShares, MAX_ASSETS, MAX_SHARES);
        _checkWithdraw(assets, totalAssets);

        UD60x18 s = wrap(totalShares);
        UD60x18 deduct = PCMath.divUp(wrap(assets), HALF_SLOPE);

        UD60x18 inner = sub(PCMath.square(s), deduct);
        UD60x18 sharesUD = sub(s, sqrt(inner));
        shares = unwrap(sharesUD);
    }

    /// @inheritdoc BaseCurve
    function convertToShares(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares
    )
        external
        view
        override
        returns (uint256 shares)
    {
        shares = _convertToShares(assets, totalAssets, totalShares);
    }

    /// @inheritdoc BaseCurve
    function convertToAssets(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets
    )
        external
        view
        override
        returns (uint256 assets)
    {
        assets = _convertToAssets(shares, totalShares, totalAssets);
    }

    /// @inheritdoc BaseCurve
    function currentPrice(uint256 totalShares, uint256 totalAssets)
        external
        view
        override
        returns (uint256 sharePrice)
    {
        _checkCurveDomains(totalAssets, totalShares, MAX_ASSETS, MAX_SHARES);
        return unwrap(mul(wrap(totalShares), SLOPE));
    }

    /* =================================================== */
    /*                    INTERNAL FUNCTIONS               */
    /* =================================================== */

    /// @dev Internal function to convert assets to shares
    function _convertToShares(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares
    )
        internal
        view
        returns (uint256 shares)
    {
        _checkCurveDomains(totalAssets, totalShares, MAX_ASSETS, MAX_SHARES);
        _checkDepositBounds(assets, totalAssets, MAX_ASSETS);

        UD60x18 s = wrap(totalShares);
        UD60x18 inner = add(PCMath.square(s), div(wrap(assets), HALF_SLOPE));
        UD60x18 sharesUD = sub(sqrt(inner), s);
        shares = unwrap(sharesUD);

        _checkDepositOut(shares, totalShares, MAX_SHARES);
    }

    /// @dev Internal function to convert shares to assets
    function _convertToAssets(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets
    )
        internal
        view
        returns (uint256 assets)
    {
        _checkCurveDomains(totalAssets, totalShares, MAX_ASSETS, MAX_SHARES);
        _checkRedeem(shares, totalShares);

        UD60x18 s = wrap(totalShares);
        UD60x18 sNext = sub(s, wrap(shares));

        UD60x18 area = sub(PCMath.square(s), PCMath.square(sNext));
        UD60x18 assetsUD = mul(area, HALF_SLOPE);
        assets = unwrap(assetsUD);
    }
}


// --- src/protocol/curves/OffsetProgressiveCurve.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

import { UD60x18, wrap, unwrap, add, sub, mul, div, sqrt, uUNIT, uMAX_UD60x18 } from "@prb/math/src/UD60x18.sol";

import { BaseCurve } from "src/protocol/curves/BaseCurve.sol";
import { ProgressiveCurveMathLib as PCMath } from "src/libraries/ProgressiveCurveMathLib.sol";

/**
 * @title  OffsetProgressiveCurve
 * @author 0xIntuition
 * @notice A modified version of the Progressive bonding curve that introduces an offset parameter
 *         to control the initial price dynamics.
 */
contract OffsetProgressiveCurve is BaseCurve {
    /* =================================================== */
    /*                     STATE                           */
    /* =================================================== */

    /// @notice The slope of the curve (18 decimal fixed-point multiplier). This is the rate at which the price of
    /// shares increases
    UD60x18 public SLOPE;

    /// @notice The half of the slope, used for calculations
    UD60x18 public HALF_SLOPE;

    /// @notice The offset of the curve. This shifts the curve along the shares axis to adjust initial pricing behavior
    UD60x18 public OFFSET;

    /// @dev The maximum shares are sqrt(uint256.max / 1e18) - offset to prevent overflow in calculations
    uint256 public MAX_SHARES;

    /// @dev The maximum assets are derived from the maximum shares and slope to prevent overflow in calculations
    uint256 public MAX_ASSETS;

    /* =================================================== */
    /*                     ERRORS                          */
    /* =================================================== */

    /// @notice Custom errors
    error OffsetProgressiveCurve_InvalidSlope();

    /* =================================================== */
    /*                     CONSTRUCTOR                     */
    /* =================================================== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /* =================================================== */
    /*                    INITIALIZER                      */
    /* =================================================== */

    /// @notice Initializes a new OffsetProgressiveCurve with the given name, slope, and offset
    /// @dev Computes maximum values given constructor arguments
    /// @param _name The name of the curve
    /// @param slope18 The slope of the curve, in 18 decimal fixed-point format
    /// @param offset18 The offset of the curve, in 18 decimal fixed-point format
    function initialize(string calldata _name, uint256 slope18, uint256 offset18) external initializer {
        __BaseCurve_init(_name);

        if (slope18 == 0 || slope18 % 2 != 0) revert OffsetProgressiveCurve_InvalidSlope();

        SLOPE = wrap(slope18);
        HALF_SLOPE = wrap(slope18 / 2);
        OFFSET = wrap(offset18);

        UD60x18 maxSharesUD = sub(sqrt(wrap(uMAX_UD60x18 / uUNIT)), OFFSET);
        UD60x18 maxAssetsUD = mul(sub(PCMath.square(add(maxSharesUD, OFFSET)), PCMath.squareUp(OFFSET)), HALF_SLOPE);

        MAX_SHARES = unwrap(maxSharesUD);
        MAX_ASSETS = unwrap(maxAssetsUD);
    }

    /* =================================================== */
    /*                   BASECURVE FUNCTIONS               */
    /* =================================================== */

    /// @inheritdoc BaseCurve
    function maxShares() external view override returns (uint256) {
        return MAX_SHARES;
    }

    /// @inheritdoc BaseCurve
    function maxAssets() external view override returns (uint256) {
        return MAX_ASSETS;
    }

    /// @inheritdoc BaseCurve
    function previewDeposit(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares
    )
        external
        view
        override
        returns (uint256 shares)
    {
        shares = _convertToShares(assets, totalAssets, totalShares);
    }

    /// @inheritdoc BaseCurve
    function previewRedeem(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets
    )
        external
        view
        override
        returns (uint256 assets)
    {
        assets = _convertToAssets(shares, totalShares, totalAssets);
    }

    /// @inheritdoc BaseCurve
    function previewMint(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets
    )
        external
        view
        override
        returns (uint256 assets)
    {
        _checkCurveDomains(totalAssets, totalShares, MAX_ASSETS, MAX_SHARES);
        _checkMintBounds(shares, totalShares, MAX_SHARES);

        UD60x18 s = add(wrap(totalShares), OFFSET);
        UD60x18 sNext = add(s, wrap(shares));

        UD60x18 area = sub(PCMath.squareUp(sNext), PCMath.square(s));
        UD60x18 assetsUD = PCMath.mulUp(area, HALF_SLOPE);
        assets = unwrap(assetsUD);

        _checkMintOut(assets, totalAssets, MAX_ASSETS);
    }

    /// @inheritdoc BaseCurve
    function previewWithdraw(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares
    )
        external
        view
        override
        returns (uint256 shares)
    {
        _checkCurveDomains(totalAssets, totalShares, MAX_ASSETS, MAX_SHARES);
        _checkWithdraw(assets, totalAssets);

        UD60x18 s = add(wrap(totalShares), OFFSET);
        UD60x18 deduct = PCMath.divUp(wrap(assets), HALF_SLOPE);

        UD60x18 inner = sub(PCMath.square(s), deduct);
        UD60x18 sharesUD = sub(s, sqrt(inner));
        shares = unwrap(sharesUD);
    }

    /// @inheritdoc BaseCurve
    function convertToShares(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares
    )
        external
        view
        override
        returns (uint256 shares)
    {
        shares = _convertToShares(assets, totalAssets, totalShares);
    }

    /// @inheritdoc BaseCurve
    function convertToAssets(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets
    )
        external
        view
        override
        returns (uint256 assets)
    {
        assets = _convertToAssets(shares, totalShares, totalAssets);
    }

    /// @inheritdoc BaseCurve
    function currentPrice(uint256 totalShares, uint256 totalAssets)
        external
        view
        override
        returns (uint256 sharePrice)
    {
        _checkCurveDomains(totalAssets, totalShares, MAX_ASSETS, MAX_SHARES);

        UD60x18 s = add(wrap(totalShares), (OFFSET));
        return unwrap(mul(s, SLOPE));
    }

    /* =================================================== */
    /*                    INTERNAL FUNCTIONS               */
    /* =================================================== */

    /// @dev Internal function to convert assets to shares
    function _convertToShares(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares
    )
        internal
        view
        returns (uint256 shares)
    {
        _checkCurveDomains(totalAssets, totalShares, MAX_ASSETS, MAX_SHARES);
        _checkDepositBounds(assets, totalAssets, MAX_ASSETS);

        UD60x18 s = add(wrap(totalShares), OFFSET);
        UD60x18 inner = add(PCMath.square(s), div(wrap(assets), HALF_SLOPE));
        UD60x18 sharesUD = sub(sqrt(inner), s);
        shares = unwrap(sharesUD);

        _checkDepositOut(shares, totalShares, MAX_SHARES);
    }

    /// @dev Internal function to convert shares to assets
    function _convertToAssets(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets
    )
        internal
        view
        returns (uint256 assets)
    {
        _checkCurveDomains(totalAssets, totalShares, MAX_ASSETS, MAX_SHARES);
        _checkRedeem(shares, totalShares);

        UD60x18 s = add(wrap(totalShares), OFFSET);
        UD60x18 sNext = sub(s, wrap(shares));

        UD60x18 area = sub(PCMath.square(s), PCMath.square(sNext));
        UD60x18 assetsUD = mul(area, HALF_SLOPE);
        assets = unwrap(assetsUD);
    }
}


// --- src/protocol/curves/BondingCurveRegistry.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";

import { IBaseCurve } from "src/interfaces/IBaseCurve.sol";
import { IBondingCurveRegistry } from "src/interfaces/IBondingCurveRegistry.sol";

/**
 * @title  BondingCurveRegistry
 * @author 0xIntuition
 * @notice Registry contract for the Intuition protocol Bonding Curves. Routes access to the curves
 *         associated with atoms & triples.  Does not maintain any economic state -- this merely
 *         performs computations based on the provided economic state.
 * @notice An administrator may add new bonding curves to this registry, including those submitted
 *         by community members, once they are verified to be safe, and conform to the BaseCurve
 *         interface.  The MultiVault supports a growing registry of curves, with each curve
 *         supplying a new "vault" for each term (atom or triple).
 * @dev    The registry is responsible for interacting with the curves, to fetch the mathematical
 *         computations given the provided economic state and the desired curve implementation.
 *         You can think of the registry as a concierge the MultiVault uses to access various
 *         economic incentive patterns.
 */
contract BondingCurveRegistry is IBondingCurveRegistry, Ownable2StepUpgradeable {
    /* =================================================== */
    /*                      ERRORS                         */
    /* =================================================== */

    error BondingCurveRegistry_ZeroAddress();
    error BondingCurveRegistry_CurveAlreadyExists();
    error BondingCurveRegistry_EmptyCurveName();
    error BondingCurveRegistry_CurveNameNotUnique();
    error BondingCurveRegistry_InvalidCurveId();

    /* =================================================== */
    /*                  STATE VARIABLES                    */
    /* =================================================== */

    /// @notice Quantity of known curves, used to assign IDs
    uint256 public count;

    /// @notice Mapping of curve IDs to curve addresses, used for lookup
    mapping(uint256 curveId => address curveAddress) public curveAddresses;

    /// @notice Mapping of curve addresses to curve IDs, for reverse lookup
    mapping(address curveAddress => uint256 curveId) public curveIds;

    /// @notice Mapping of the registered curve names, used to enforce uniqueness
    mapping(string curveName => bool registered) public registeredCurveNames;

    /* =================================================== */
    /*                    MODIFIERS                        */
    /* =================================================== */

    modifier onlyValidCurveId(uint256 id) {
        if (!_isCurveIdValid(id)) revert BondingCurveRegistry_InvalidCurveId();
        _;
    }

    /* =================================================== */
    /*                    CONSTRUCTOR                      */
    /* =================================================== */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /* =================================================== */
    /*                    INITIALIZER                      */
    /* =================================================== */

    /// @notice Initialize the BondingCurveRegistry contract
    /// @param _admin Address who may add curves to the registry
    function initialize(address _admin) external initializer {
        __Ownable_init(_admin);
    }

    /* =================================================== */
    /*              ACCESS-RESTRICTED FUNCTIONS            */
    /* =================================================== */

    /// @notice Add a new bonding curve to the registry
    /// @param bondingCurve Address of the new bonding curve
    function addBondingCurve(address bondingCurve) external onlyOwner {
        if (bondingCurve == address(0)) {
            revert BondingCurveRegistry_ZeroAddress();
        }

        // Ensure curve is not already registered
        if (curveIds[bondingCurve] != 0) {
            revert BondingCurveRegistry_CurveAlreadyExists();
        }

        string memory curveName = IBaseCurve(bondingCurve).name();

        // Ensure the curve name is not empty
        if (bytes(curveName).length == 0) {
            revert BondingCurveRegistry_EmptyCurveName();
        }

        // Enforce curve name uniqueness
        if (registeredCurveNames[curveName]) {
            revert BondingCurveRegistry_CurveNameNotUnique();
        }

        // 0 is reserved to safeguard against uninitialized values
        ++count;

        // Add the curve to the registry, keeping track of its address and ID in separate tables
        curveAddresses[count] = bondingCurve;
        curveIds[bondingCurve] = count;

        // Mark the curve name as registered
        registeredCurveNames[curveName] = true;

        emit BondingCurveAdded(count, bondingCurve, curveName);
    }

    /* =================================================== */
    /*                VIEW FUNCTIONS                       */
    /* =================================================== */

    /// @notice Preview how many shares would be minted for a deposit of assets
    /// @param assets Quantity of assets to deposit
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @param id Curve ID to use for the calculation
    /// @return shares The number of shares that would be minted
    function previewDeposit(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares,
        uint256 id
    )
        external
        view
        onlyValidCurveId(id)
        returns (uint256 shares)
    {
        return IBaseCurve(curveAddresses[id]).previewDeposit(assets, totalAssets, totalShares);
    }

    /// @notice Preview how many assets would be returned for burning a specific amount of shares
    /// @param shares Quantity of shares to burn
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @param id Curve ID to use for the calculation
    /// @return assets The number of assets that would be returned
    function previewRedeem(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets,
        uint256 id
    )
        external
        view
        onlyValidCurveId(id)
        returns (uint256 assets)
    {
        return IBaseCurve(curveAddresses[id]).previewRedeem(shares, totalShares, totalAssets);
    }

    /// @notice Preview how many assets would be required to mint a specific amount of shares
    /// @param shares Quantity of shares to mint
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @param id Curve ID to use for the calculation
    /// @return assets The number of assets that would be required to mint the shares
    function previewMint(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets,
        uint256 id
    )
        external
        view
        onlyValidCurveId(id)
        returns (uint256 assets)
    {
        return IBaseCurve(curveAddresses[id]).previewMint(shares, totalShares, totalAssets);
    }

    /// @notice Preview how many shares would be redeemed for a withdrawal of assets
    /// @param assets Quantity of assets to withdraw
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @param id Curve ID to use for the calculation
    /// @return shares The number of shares that would need to be redeemed
    function previewWithdraw(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares,
        uint256 id
    )
        external
        view
        onlyValidCurveId(id)
        returns (uint256 shares)
    {
        return IBaseCurve(curveAddresses[id]).previewWithdraw(assets, totalAssets, totalShares);
    }

    /// @notice Convert assets to shares at a specific point on the curve
    /// @param assets Quantity of assets to convert to shares
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @param id Curve ID to use for the calculation
    /// @return shares The number of shares equivalent to the given assets
    function convertToShares(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares,
        uint256 id
    )
        external
        view
        onlyValidCurveId(id)
        returns (uint256 shares)
    {
        return IBaseCurve(curveAddresses[id]).convertToShares(assets, totalAssets, totalShares);
    }

    /// @notice Convert shares to assets at a specific point on the curve
    /// @param shares Quantity of shares to convert to assets
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @param id Curve ID to use for the calculation
    /// @return assets The number of assets equivalent to the given shares
    function convertToAssets(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets,
        uint256 id
    )
        external
        view
        onlyValidCurveId(id)
        returns (uint256 assets)
    {
        return IBaseCurve(curveAddresses[id]).convertToAssets(shares, totalShares, totalAssets);
    }

    /// @notice Get the current price of a share
    /// @param id Curve ID to use for the calculation
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @return sharePrice The current price of a share
    function currentPrice(
        uint256 id,
        uint256 totalShares,
        uint256 totalAssets
    )
        external
        view
        onlyValidCurveId(id)
        returns (uint256 sharePrice)
    {
        return IBaseCurve(curveAddresses[id]).currentPrice(totalShares, totalAssets);
    }

    /// @notice Get the name of a curve
    /// @param id Curve ID to query
    /// @return name The name of the curve
    function getCurveName(uint256 id) external view onlyValidCurveId(id) returns (string memory name) {
        return IBaseCurve(curveAddresses[id]).name();
    }

    /// @notice Get the maximum number of shares a curve can handle.  Curves compute this ceiling based on their
    /// constructor arguments, to avoid overflow.
    /// @param id Curve ID to query
    /// @return maxShares The maximum number of shares
    function getCurveMaxShares(uint256 id) external view onlyValidCurveId(id) returns (uint256 maxShares) {
        return IBaseCurve(curveAddresses[id]).maxShares();
    }

    /// @notice Get the maximum number of assets a curve can handle.  Curves compute this ceiling based on their
    /// constructor arguments, to avoid overflow.
    /// @param id Curve ID to query
    /// @return maxAssets The maximum number of assets
    function getCurveMaxAssets(uint256 id) external view onlyValidCurveId(id) returns (uint256 maxAssets) {
        return IBaseCurve(curveAddresses[id]).maxAssets();
    }

    /// @notice Check if a curve ID is valid
    /// @param id Curve ID to check
    /// @return valid True if the curve ID is valid, false otherwise
    function isCurveIdValid(uint256 id) external view returns (bool valid) {
        return _isCurveIdValid(id);
    }

    /* =================================================== */
    /*                INTERNAL FUNCTIONS                   */
    /* =================================================== */

    /// @dev Internal function to check if a curve ID is valid
    function _isCurveIdValid(uint256 id) internal view returns (bool valid) {
        return id > 0 && id <= count;
    }
}


// --- src/external/curve/VotingEscrow.sol ---
// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

/**
 * https://github.com/stargate-protocol/stargate-dao/blob/main/contracts/VotingEscrow.sol
 */
/**
 * @title Voting Escrow
 * @author Curve Finance
 * @notice Votes have a weight depending on time, so that users are
 *         committed to the future of (whatever they are voting for)
 * @dev Vote weight decays linearly over time. Lock time cannot be
 *      more than `MAXTIME` (2 years).
 *
 * # Voting escrow to have time-weighted votes
 * # Votes have a weight depending on time, so that users are committed
 * # to the future of (whatever they are voting for).
 * # The weight in this implementation is linear, and lock cannot be more than maxtime:
 * # w ^
 * # 1 +        /
 * #   |      /
 * #   |    /
 * #   |  /
 * #   |/
 * # 0 +--------+------> time
 * #       maxtime (2 years?)
 */
import { IERC20 } from "@openzeppelin/contracts/interfaces/IERC20.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Removed from original source.
// import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";

// Replaces Ownable2StepUpgradeable
import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

struct Point {
    int128 bias;
    int128 slope; // # -dweight / dt
    uint256 ts;
    uint256 blk; // block
}
/* We cannot really do block numbers per se b/c slope is per time, not per block
 * and per block could be fairly bad b/c Ethereum changes blocktimes.
 * What we can do is to extrapolate ***At functions */

struct LockedBalance {
    int128 amount;
    uint256 end;
}

contract VotingEscrow is AccessControlUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    enum DepositType {
        DEPOSIT_FOR_TYPE,
        CREATE_LOCK_TYPE,
        INCREASE_LOCK_AMOUNT,
        INCREASE_UNLOCK_TIME
    }

    event TokenSet(address token);
    event MinTimeSet(uint256 min_time);
    event Deposit(
        address indexed provider, uint256 value, uint256 indexed locktime, DepositType deposit_type, uint256 ts
    );
    event Withdraw(address indexed provider, uint256 value, uint256 ts);
    event Supply(uint256 prevSupply, uint256 supply);

    uint256 internal constant WEEK = 1 weeks;
    uint256 public constant MAXTIME = 2 * 365 * 86_400;
    int128 internal constant iMAXTIME = 2 * 365 * 86_400;
    uint256 internal constant MULTIPLIER = 1 ether;

    uint256 public MINTIME;
    address public token;
    uint256 public supply;
    bool public unlocked;

    mapping(address => LockedBalance) public locked;

    uint256 public epoch;
    mapping(uint256 => Point) public point_history; // epoch -> unsigned point
    mapping(address => Point[1_000_000_000]) public user_point_history; // user -> Point[user_epoch]
    mapping(address => uint256) public user_point_epoch;
    mapping(uint256 => int128) public slope_changes; // time -> signed slope change

    // Aragon's view methods for compatibility
    address public controller;
    bool public transfersEnabled;

    string public constant name = "Vote-escrowed TRUST";
    string public constant symbol = "veTRUST";
    string public constant version = "1.0.0";
    uint8 public constant decimals = 18;

    // Whitelisted (smart contract) wallets which are allowed to deposit
    // The goal is to prevent tokenizing the escrow
    mapping(address => bool) public contracts_whitelist;

    /// @dev Gap for upgrade safety
    uint256[50] private __gap;

    /// @dev Initialize the VotingEscrow contract and its dependencies
    function __VotingEscrow_init(address _admin, address token_addr, uint256 min_time) internal onlyInitializing {
        require(token_addr != address(0), "Token address cannot be 0");
        require(min_time >= 2 * WEEK, "Min lock time must be at least 2 weeks");

        __AccessControl_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);

        token = token_addr;
        point_history[0].blk = block.number;
        point_history[0].ts = block.timestamp;
        controller = _admin;
        transfersEnabled = true;
        MINTIME = min_time;

        emit TokenSet(token_addr);
        emit MinTimeSet(min_time);
    }

    modifier onlyUserOrWhitelist() {
        if (msg.sender != tx.origin) {
            require(contracts_whitelist[msg.sender], "Smart contract not allowed");
        }
        _;
    }

    modifier notUnlocked() {
        require(!unlocked, "unlocked globally");
        _;
    }

    /// @notice Add address to whitelist smart contract depositors `addr`
    /// @param addr Address to be whitelisted
    function add_to_whitelist(address addr) external onlyRole(DEFAULT_ADMIN_ROLE) {
        contracts_whitelist[addr] = true;
    }

    /// @notice Remove a smart contract address from whitelist
    /// @param addr Address to be removed from whitelist
    function remove_from_whitelist(address addr) external onlyRole(DEFAULT_ADMIN_ROLE) {
        contracts_whitelist[addr] = false;
    }

    /// @notice Unlock all locked balances
    function unlock() external onlyRole(DEFAULT_ADMIN_ROLE) {
        unlocked = true;
    }

    /// @notice Get the most recently recorded rate of voting power decrease for `_addr`
    /// @param addr Address of the user wallet
    /// @return Value of the slope
    function get_last_user_slope(address addr) external view returns (int128) {
        uint256 uepoch = user_point_epoch[addr];
        return user_point_history[addr][uepoch].slope;
    }

    /// @notice Get the timestamp for checkpoint `_idx` for `_addr`
    /// @param _addr User wallet address
    /// @param _idx User epoch number
    /// @return Epoch time of the checkpoint
    function user_point_history__ts(address _addr, uint256 _idx) external view returns (uint256) {
        return user_point_history[_addr][_idx].ts;
    }

    /// @notice Get timestamp when `_addr`'s lock finishes
    /// @param _addr User wallet address
    /// @return Epoch time of the lock end
    function locked__end(address _addr) external view returns (uint256) {
        return locked[_addr].end;
    }

    /// @notice Record global and per-user data to checkpoint
    /// @param _addr User's wallet address. No user checkpoint if 0x0
    /// @param old_locked Pevious locked amount / end lock time for the user
    /// @param new_locked New locked amount / end lock time for the user
    function _checkpoint(address _addr, LockedBalance memory old_locked, LockedBalance memory new_locked) internal {
        Point memory u_old;
        Point memory u_new;
        int128 old_dslope = 0;
        int128 new_dslope = 0;
        uint256 _epoch = epoch;

        if (_addr != address(0x0)) {
            // Calculate slopes and biases
            // Kept at zero when they have to
            if (old_locked.end > block.timestamp && old_locked.amount > 0) {
                u_old.slope = old_locked.amount / iMAXTIME;
                u_old.bias = u_old.slope * int128(int256(old_locked.end - block.timestamp));
            }
            if (new_locked.end > block.timestamp && new_locked.amount > 0) {
                u_new.slope = new_locked.amount / iMAXTIME;
                u_new.bias = u_new.slope * int128(int256(new_locked.end - block.timestamp));
            }

            // Read values of scheduled changes in the slope
            // old_locked.end can be in the past and in the future
            // new_locked.end can ONLY by in the FUTURE unless everything expired: than zeros
            old_dslope = slope_changes[old_locked.end];
            if (new_locked.end != 0) {
                if (new_locked.end == old_locked.end) {
                    new_dslope = old_dslope;
                } else {
                    new_dslope = slope_changes[new_locked.end];
                }
            }
        }

        Point memory last_point = Point({ bias: 0, slope: 0, ts: block.timestamp, blk: block.number });
        if (_epoch > 0) {
            last_point = point_history[_epoch];
        }
        uint256 last_checkpoint = last_point.ts;
        // initial_last_point is used for extrapolation to calculate block number
        // (approximately, for *At methods) and save them
        // as we cannot figure that out exactly from inside the contract

        uint256 initial_last_point_ts = last_point.ts;
        uint256 initial_last_point_blk = last_point.blk;

        uint256 block_slope = 0; // dblock/dt
        if (block.timestamp > last_point.ts) {
            block_slope = (MULTIPLIER * (block.number - last_point.blk)) / (block.timestamp - last_point.ts);
        }
        // If last point is already recorded in this block, slope=0
        // But that's ok b/c we know the block in such case

        // Go over weeks to fill history and calculate what the current point is
        uint256 t_i = (last_checkpoint / WEEK) * WEEK;
        for (uint256 i = 0; i < 255; ++i) {
            // Hopefully it won't happen that this won't get used in 5 years!
            // If it does, users will be able to withdraw but vote weight will be broken
            t_i += WEEK;
            int128 d_slope = 0;
            if (t_i > block.timestamp) {
                t_i = block.timestamp;
            } else {
                d_slope = slope_changes[t_i];
            }
            last_point.bias -= last_point.slope * int128(int256(t_i - last_checkpoint));
            last_point.slope += d_slope;
            if (last_point.bias < 0) {
                // This can happen
                last_point.bias = 0;
            }
            if (last_point.slope < 0) {
                // This cannot happen - just in case
                last_point.slope = 0;
            }
            last_checkpoint = t_i;
            last_point.ts = t_i;
            last_point.blk = initial_last_point_blk + (block_slope * (t_i - initial_last_point_ts)) / MULTIPLIER;

            _epoch += 1;
            if (t_i == block.timestamp) {
                last_point.blk = block.number;
                break;
            } else {
                point_history[_epoch] = last_point;
            }
        }

        epoch = _epoch;
        // Now point_history is filled until t=now

        if (_addr != address(0x0)) {
            // If last point was in this block, the slope change has been applied already
            // But in such case we have 0 slope(s)
            last_point.slope += (u_new.slope - u_old.slope);
            last_point.bias += (u_new.bias - u_old.bias);
            if (last_point.slope < 0) {
                last_point.slope = 0;
            }
            if (last_point.bias < 0) {
                last_point.bias = 0;
            }
        }

        // Record the changed point into history
        point_history[_epoch] = last_point;

        if (_addr != address(0x0)) {
            // Schedule the slope changes (slope is going down)
            // We subtract new_user_slope from [new_locked.end]
            // and add old_user_slope to [old_locked.end]
            if (old_locked.end > block.timestamp) {
                // old_dslope was <something> - u_old.slope, so we cancel that
                old_dslope += u_old.slope;
                if (new_locked.end == old_locked.end) {
                    old_dslope -= u_new.slope; // It was a new deposit, not extension
                }
                slope_changes[old_locked.end] = old_dslope;
            }

            if (new_locked.end > block.timestamp) {
                if (new_locked.end > old_locked.end) {
                    new_dslope -= u_new.slope; // old slope disappeared at this point
                    slope_changes[new_locked.end] = new_dslope;
                }
                // else: we recorded it already in old_dslope
            }
            // Now handle user history
            address addr = _addr;
            uint256 user_epoch = user_point_epoch[addr] + 1;

            user_point_epoch[addr] = user_epoch;
            u_new.ts = block.timestamp;
            u_new.blk = block.number;
            user_point_history[addr][user_epoch] = u_new;
        }
    }

    /// @notice Deposit and lock tokens for a user
    /// @param _addr User's wallet address
    /// @param _value Amount to deposit
    /// @param unlock_time New time when to unlock the tokens, or 0 if unchanged
    /// @param locked_balance Previous locked amount / timestamp
    /// @param deposit_type The type of deposit
    function _deposit_for(
        address _addr,
        uint256 _value,
        uint256 unlock_time,
        LockedBalance memory locked_balance,
        DepositType deposit_type
    )
        internal
    {
        LockedBalance memory _locked = locked_balance;
        uint256 supply_before = supply;

        supply = supply_before + _value;
        LockedBalance memory old_locked;
        (old_locked.amount, old_locked.end) = (_locked.amount, _locked.end);
        // Adding to existing lock, or if a lock is expired - creating a new one
        _locked.amount += int128(int256(_value));
        if (unlock_time != 0) {
            _locked.end = unlock_time;
        }
        locked[_addr] = _locked;

        // Possibilities:
        // Both old_locked.end could be current or expired (>/< block.timestamp)
        // value == 0 (extend lock) or value > 0 (add to lock or extend lock)
        // _locked.end > block.timestamp (always)
        _checkpoint(_addr, old_locked, _locked);

        if (_value != 0) {
            IERC20(token).safeTransferFrom(_addr, address(this), _value);
        }

        emit Deposit(_addr, _value, _locked.end, deposit_type, block.timestamp);
        emit Supply(supply_before, supply_before + _value);
    }

    /// @notice Record global data to checkpoint
    function checkpoint() external notUnlocked {
        _checkpoint(address(0x0), LockedBalance(0, 0), LockedBalance(0, 0));
    }

    /// @notice Deposit `_value` tokens for `_addr` and add to the lock
    /// @dev Anyone (even a smart contract) can deposit for someone else, but
    ///      cannot extend their locktime and deposit for a brand new user
    /// @param _addr User's wallet address
    /// @param _value Amount to add to user's lock
    function deposit_for(address _addr, uint256 _value) external nonReentrant notUnlocked {
        LockedBalance memory _locked = locked[_addr];

        require(_value > 0); // dev: need non-zero value
        require(_locked.amount > 0, "No existing lock found");
        require(_locked.end > block.timestamp, "Cannot add to expired lock. Withdraw");
        _deposit_for(_addr, _value, 0, _locked, DepositType.DEPOSIT_FOR_TYPE);
    }

    /// @notice Deposit `_value` tokens for `msg.sender` and lock until `_unlock_time`
    /// @param _value Amount to deposit
    /// @param _unlock_time Epoch time when tokens unlock, rounded down to whole weeks
    function _create_lock(uint256 _value, uint256 _unlock_time) internal {
        require(_value > 0); // dev: need non-zero value

        LockedBalance memory _locked = locked[msg.sender];
        require(_locked.amount == 0, "Withdraw old tokens first");

        uint256 unlock_time = (_unlock_time / WEEK) * WEEK; // Locktime is rounded down to weeks
        require(unlock_time >= block.timestamp + MINTIME, "Voting lock must be at least MINTIME");
        require(unlock_time <= block.timestamp + MAXTIME, "Voting lock can be 2 years max");

        _deposit_for(msg.sender, _value, unlock_time, _locked, DepositType.CREATE_LOCK_TYPE);
    }

    /// @notice External function for _create_lock
    /// @param _value Amount to deposit
    /// @param _unlock_time Epoch time when tokens unlock, rounded down to whole weeks
    function create_lock(uint256 _value, uint256 _unlock_time) external nonReentrant onlyUserOrWhitelist notUnlocked {
        _create_lock(_value, _unlock_time);
    }

    /// @notice Deposit `_value` additional tokens for `msg.sender` without modifying the unlock time
    /// @param _value Amount of tokens to deposit and add to the lock
    function increase_amount(uint256 _value) external nonReentrant onlyUserOrWhitelist notUnlocked {
        _increase_amount(_value);
    }

    function _increase_amount(uint256 _value) internal {
        LockedBalance memory _locked = locked[msg.sender];

        require(_value > 0); // dev: need non-zero value
        require(_locked.amount > 0, "No existing lock found");
        require(_locked.end > block.timestamp, "Cannot add to expired lock. Withdraw");

        _deposit_for(msg.sender, _value, 0, _locked, DepositType.INCREASE_LOCK_AMOUNT);
    }

    /// @notice Extend the unlock time for `msg.sender` to `_unlock_time`
    /// @param _unlock_time New epoch time for unlocking
    function increase_unlock_time(uint256 _unlock_time) external nonReentrant onlyUserOrWhitelist notUnlocked {
        _increase_unlock_time(_unlock_time);
    }

    function _increase_unlock_time(uint256 _unlock_time) internal {
        LockedBalance memory _locked = locked[msg.sender];
        uint256 unlock_time = (_unlock_time / WEEK) * WEEK; // Locktime is rounded down to weeks

        require(_locked.end > block.timestamp, "Lock expired");
        require(_locked.amount > 0, "Nothing is locked");
        require(unlock_time > _locked.end, "Can only increase lock duration");
        require(unlock_time <= block.timestamp + MAXTIME, "Voting lock can be 2 years max");

        _deposit_for(msg.sender, 0, unlock_time, _locked, DepositType.INCREASE_UNLOCK_TIME);
    }

    /// @notice Extend the unlock time and/or for `msg.sender` to `_unlock_time`
    /// @param _unlock_time New epoch time for unlocking
    function increase_amount_and_time(
        uint256 _value,
        uint256 _unlock_time
    )
        external
        nonReentrant
        onlyUserOrWhitelist
        notUnlocked
    {
        require(_value > 0 || _unlock_time > 0, "Value and Unlock cannot both be 0");
        if (_value > 0 && _unlock_time > 0) {
            _increase_amount(_value);
            _increase_unlock_time(_unlock_time);
        } else if (_value > 0 && _unlock_time == 0) {
            _increase_amount(_value);
        } else {
            _increase_unlock_time(_unlock_time);
        }
    }

    /// @notice Withdraw all tokens for `msg.sender`
    /// @dev Only possible if the lock has expired
    function _withdraw() internal {
        LockedBalance memory _locked = locked[msg.sender];
        uint256 value = uint256(int256(_locked.amount));

        if (!unlocked) {
            require(block.timestamp >= _locked.end, "The lock didn't expire");
        }

        locked[msg.sender] = LockedBalance(0, 0);
        uint256 supply_before = supply;
        supply = supply_before - value;

        // old_locked can have either expired <= timestamp or zero end
        // _locked has only 0 end
        // Both can have >= 0 amount
        _checkpoint(msg.sender, _locked, LockedBalance(0, 0));

        IERC20(token).safeTransfer(msg.sender, value);

        emit Withdraw(msg.sender, value, block.timestamp);
        emit Supply(supply_before, supply_before - value);
    }

    function withdraw() external nonReentrant {
        _withdraw();
    }

    /// @notice Deposit `_value` tokens for `msg.sender` and lock until `_unlock_time`
    /// @param _value Amount to deposit
    /// @param _unlock_time Epoch time when tokens unlock, rounded down to whole weeks
    function withdraw_and_create_lock(
        uint256 _value,
        uint256 _unlock_time
    )
        external
        nonReentrant
        onlyUserOrWhitelist
        notUnlocked
    {
        _withdraw();
        _create_lock(_value, _unlock_time);
    }

    // The following ERC20/minime-compatible methods are not real balanceOf and supply!
    // They measure the weights for the purpose of voting, so they don't represent
    // real coins.

    /// @notice Binary search to estimate timestamp for block number
    /// @param _block Block to find
    /// @param max_epoch Don't go beyond this epoch
    /// @return Approximate timestamp for block
    function _find_block_epoch(uint256 _block, uint256 max_epoch) internal view returns (uint256) {
        // Binary search
        uint256 _min = 0;
        uint256 _max = max_epoch;
        for (uint256 i = 0; i < 128; ++i) {
            // Will be always enough for 128-bit numbers
            if (_min >= _max) {
                break;
            }
            uint256 _mid = (_min + _max + 1) / 2;
            if (point_history[_mid].blk <= _block) {
                _min = _mid;
            } else {
                _max = _mid - 1;
            }
        }
        return _min;
    }

    /**
     * @notice Find the latest global epoch whose checkpoint timestamp is <= `_ts`.
     * @dev Performs a binary search over `point_history` in the range
     *      [0, max_epoch]. The returned index is the greatest `epoch`
     *      such that `point_history[epoch].ts <= _ts`. If no such epoch
     *      exists (i.e. all checkpoints are strictly after `_ts`), this
     *      function returns 0.
     * @param _ts Timestamp to search for.
     * @param max_epoch Upper bound (inclusive) for the epoch search.
     * @return epoch Index of the global epoch with the largest timestamp
     *               less than or equal to `_ts`.
     */
    function _find_timestamp_epoch(uint256 _ts, uint256 max_epoch) internal view returns (uint256) {
        // No checkpoints at all means no supply
        if (max_epoch == 0) {
            return 0;
        }

        // If asking before the first checkpoint, supply is zero
        if (_ts < point_history[0].ts) {
            return 0;
        }

        // If asking after the last checkpoint, return last epoch
        if (_ts >= point_history[max_epoch].ts) {
            return max_epoch;
        }

        // Binary search
        uint256 _min = 0;
        uint256 _max = max_epoch;
        for (uint256 i = 0; i < 128; ++i) {
            // Will be always enough for 128-bit numbers
            if (_min >= _max) {
                break;
            }
            uint256 _mid = (_min + _max + 1) / 2;
            if (point_history[_mid].ts <= _ts) {
                _min = _mid;
            } else {
                _max = _mid - 1;
            }
        }
        return _min;
    }

    /**
     * @notice Find the latest user epoch whose checkpoint timestamp is <= `_ts`.
     * @dev Performs a binary search over `user_point_history[addr]` in the
     *      range [0, user_point_epoch[addr]]. The returned index is the greatest
     *      `epoch` such that `user_point_history[addr][epoch].ts <= _ts`.
     *      If the user has no checkpoint at or before `_ts`, this function
     *      returns 0.
     * @param addr Address of the user.
     * @param _ts Timestamp to search for.
     * @return epoch Index of the user epoch with the largest timestamp less
     *               than or equal to `_ts`.
     */
    function _find_user_timestamp_epoch(address addr, uint256 _ts, uint256 max_epoch) internal view returns (uint256) {
        // No checkpoints at all means no balance
        if (max_epoch == 0) {
            return 0;
        }

        // If asking before the first checkpoint, balance is zero
        if (_ts < user_point_history[addr][0].ts) {
            return 0;
        }

        // If asking after the last checkpoint, return last epoch
        if (_ts >= user_point_history[addr][max_epoch].ts) {
            return max_epoch;
        }

        // Binary search
        uint256 _min = 0;
        uint256 _max = max_epoch;

        for (uint256 i = 0; i < 128; ++i) {
            // Will be always enough for 128-bit numbers
            if (_min >= _max) {
                break;
            }
            uint256 _mid = (_min + _max + 1) / 2;
            if (user_point_history[addr][_mid].ts <= _ts) {
                _min = _mid;
            } else {
                _max = _mid - 1;
            }
        }
        return _min;
    }

    /// @notice Calculate voting power of `addr` at time `_t`
    /// @dev Adheres to the ERC20 `balanceOf` interface for Aragon compatibility
    /// @param addr User wallet address
    /// @param _t Epoch time to return voting power at
    /// @return User voting power
    function _balanceOf(address addr, uint256 _t) internal view returns (uint256) {
        uint256 target_epoch = _find_user_timestamp_epoch(addr, _t, user_point_epoch[addr]);
        Point memory point = user_point_history[addr][target_epoch];
        point.bias -= point.slope * int128(int256(_t) - int256(point.ts));
        if (point.bias < 0) {
            point.bias = 0;
        }
        return uint256(int256(point.bias));
    }

    function balanceOfAtT(address addr, uint256 _t) external view returns (uint256) {
        return _balanceOf(addr, _t);
    }

    function balanceOf(address addr) external view returns (uint256) {
        return _balanceOf(addr, block.timestamp);
    }

    /// @notice Measure voting power of `addr` at block height `_block`
    /// @dev Adheres to MiniMe `balanceOfAt` interface: https://github.com/Giveth/minime
    /// @param addr User's wallet address
    /// @param _block Block to calculate the voting power at
    /// @return Voting power
    function balanceOfAt(address addr, uint256 _block) external view returns (uint256) {
        require(_block <= block.number, "block in the future");

        // Binary search
        uint256 _min = 0;
        uint256 _max = user_point_epoch[addr];
        for (uint256 i = 0; i < 128; ++i) {
            // Will be always enough for 128-bit numbers
            if (_min >= _max) {
                break;
            }
            uint256 _mid = (_min + _max + 1) / 2;
            if (user_point_history[addr][_mid].blk <= _block) {
                _min = _mid;
            } else {
                _max = _mid - 1;
            }
        }

        Point memory upoint = user_point_history[addr][_min];

        uint256 max_epoch = epoch;
        uint256 _epoch = _find_block_epoch(_block, max_epoch);
        Point memory point_0 = point_history[_epoch];
        uint256 d_block = 0;
        uint256 d_t = 0;
        if (_epoch < max_epoch) {
            Point memory point_1 = point_history[_epoch + 1];
            d_block = point_1.blk - point_0.blk;
            d_t = point_1.ts - point_0.ts;
        } else {
            d_block = block.number - point_0.blk;
            d_t = block.timestamp - point_0.ts;
        }
        uint256 block_time = point_0.ts;
        if (d_block != 0) {
            block_time += (d_t * (_block - point_0.blk)) / d_block;
        }

        upoint.bias -= upoint.slope * int128(int256(block_time - upoint.ts));
        if (upoint.bias >= 0) {
            return uint256(uint128(upoint.bias));
        } else {
            return 0;
        }
    }

    /// @notice Calculate total voting power at some point in the past
    /// @param point The point (bias/slope) to start search from
    /// @param t Time to calculate the total voting power at
    /// @return Total voting power at that time
    function _supply_at(Point memory point, uint256 t) internal view returns (uint256) {
        Point memory last_point = point;
        uint256 t_i = (last_point.ts / WEEK) * WEEK;
        for (uint256 i = 0; i < 255; ++i) {
            t_i += WEEK;
            int128 d_slope = 0;
            if (t_i > t) {
                t_i = t;
            } else {
                d_slope = slope_changes[t_i];
            }
            last_point.bias -= last_point.slope * int128(int256(t_i - last_point.ts));
            if (t_i == t) {
                break;
            }
            last_point.slope += d_slope;
            last_point.ts = t_i;
        }

        if (last_point.bias < 0) {
            last_point.bias = 0;
        }
        return uint256(uint128(last_point.bias));
    }

    /// @notice Calculate total voting power
    /// @dev Adheres to the ERC20 `totalSupply` interface for Aragon compatibility
    /// @return Total voting power
    function _totalSupply(uint256 t) internal view returns (uint256) {
        uint256 target_epoch = _find_timestamp_epoch(t, epoch);
        Point memory point = point_history[target_epoch];
        return _supply_at(point, t);
    }

    function totalSupplyAtT(uint256 t) external view returns (uint256) {
        return _totalSupply(t);
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply(block.timestamp);
    }

    /// @notice Calculate total voting power at some point in the past
    /// @param _block Block to calculate the total voting power at
    /// @return Total voting power at `_block`
    function totalSupplyAt(uint256 _block) external view returns (uint256) {
        require(_block <= block.number, "block in the future");

        uint256 _epoch = epoch;
        uint256 target_epoch = _find_block_epoch(_block, _epoch);

        Point memory point = point_history[target_epoch];
        uint256 dt = 0;
        if (target_epoch < _epoch) {
            Point memory point_next = point_history[target_epoch + 1];
            if (point.blk != point_next.blk) {
                dt = ((_block - point.blk) * (point_next.ts - point.ts)) / (point_next.blk - point.blk);
            }
        } else {
            if (point.blk != block.number) {
                dt = ((_block - point.blk) * (block.timestamp - point.ts)) / (block.number - point.blk);
            }
        }
        // Now dt contains info on how far are we beyond point
        return _supply_at(point, point.ts + dt);
    }

    // Dummy methods for compatibility with Aragon
    function changeController(address _newController) external {
        require(msg.sender == controller);
        controller = _newController;
    }
}


// --- src/interfaces/IBaseEmissionsController.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

import { FinalityState } from "src/protocol/emissions/MetaERC20Dispatcher.sol";

/**
 * @title  IBaseEmissionsController
 * @author 0xIntuition
 * @notice Interface for the BaseEmissionsController that controls the release of TRUST tokens by sending mint requests
 * to the TRUST token.
 */
interface IBaseEmissionsController {
    /* =================================================== */
    /*                       EVENTS                        */
    /* =================================================== */

    /**
     * @notice Event emitted when the Trust token address is updated
     * @param newTrustToken The new Trust token address
     */
    event TrustTokenUpdated(address indexed newTrustToken);

    /**
     * @notice Event emitted when the Satellite Emissions Controller address is updated
     * @param newSatelliteEmissionsController The new Satellite Emissions Controller address
     */
    event SatelliteEmissionsControllerUpdated(address indexed newSatelliteEmissionsController);

    /**
     * @notice Event emitted when Trust tokens are minted and bridged
     * @param to Address that received the minted Trust tokens
     * @param amount Amount of Trust tokens minted
     * @param epoch Epoch for which the tokens were minted
     */
    event TrustMintedAndBridged(address indexed to, uint256 amount, uint256 epoch);

    /**
     * @notice Event emitted when the Trust tokens are burned
     * @param from Address that burned the Trust tokens
     * @param amount Amount of Trust tokens burned
     */
    event TrustBurned(address indexed from, uint256 amount);

    /**
     * @notice Event emitted when ETH is withdrawn from the contract
     * @param to Address that received the withdrawn ETH
     * @param amount Amount of ETH withdrawn
     */
    event Transfer(address indexed from, address indexed to, uint256 amount);

    /* =================================================== */
    /*                       ERRORS                        */
    /* =================================================== */

    error BaseEmissionsController_InvalidAddress();
    error BaseEmissionsController_InvalidEpoch();
    error BaseEmissionsController_InsufficientGasPayment();
    error BaseEmissionsController_EpochMintingLimitExceeded();
    error BaseEmissionsController_InsufficientBurnableBalance();
    error BaseEmissionsController_SatelliteEmissionsControllerNotSet();

    /* =================================================== */
    /*                      GETTERS                        */
    /* =================================================== */

    /**
     * @notice Get the Trust token contract address
     * @return The address of the Trust token contract
     */
    function getTrustToken() external view returns (address);

    /**
     * @notice Get the Satellite Emissions Controller contract address
     * @return The address of the Satellite Emissions Controller contract
     */
    function getSatelliteEmissionsController() external view returns (address);

    /**
     * @notice Get the total amount of Trust tokens minted
     * @return The total amount of Trust tokens minted
     */
    function getTotalMinted() external view returns (uint256);

    /**
     * @notice Get the amount of Trust tokens minted for a specific epoch
     * @param epoch The epoch to query
     * @return The amount of Trust tokens minted for the given epoch
     */
    function getEpochMintedAmount(uint256 epoch) external view returns (uint256);

    /* =================================================== */
    /*                    CONTROLLER                       */
    /* =================================================== */

    /**
     * @notice Withdraw native gas tokens from the contract
     * @dev Only callable by addresses with CONTROLLER_ROLE
     * @param epoch The epoch to mint tokens for
     */
    function withdraw(uint256 epoch) external;

    /**
     * @notice Mint new TRUST tokens for the current epoch and bridge them to the satellite emissions controller
     * @dev Only callable by addresses with CONTROLLER_ROLE
     */
    function mintAndBridgeCurrentEpoch() external;

    /**
     * @notice Mint new TRUST tokens for a specific epoch and bridge them to the satellite emissions controller
     * @dev Only callable by addresses with CONTROLLER_ROLE
     * @param epoch The epoch to mint tokens for
     */
    function mintAndBridge(uint256 epoch) external payable;

    /* =================================================== */
    /*                       ADMIN                         */
    /* =================================================== */

    /**
     * @notice Set the Trust token contract address
     * @dev Only callable by addresses with DEFAULT_ADMIN_ROLE
     * @param newTrustToken The new Trust token contract address
     */
    function setTrustToken(address newTrustToken) external;

    /**
     * @notice Set the Satellite Emissions Controller contract address
     * @dev Only callable by addresses with DEFAULT_ADMIN_ROLE
     * @param newSatelliteEmissionsController The new Satellite Emissions Controller contract address
     */
    function setSatelliteEmissionsController(address newSatelliteEmissionsController) external;

    /**
     * @notice Set the message gas cost for cross-chain operations
     * @dev Only callable by addresses with DEFAULT_ADMIN_ROLE
     * @param newGasCost The new gas cost value
     */
    function setMessageGasCost(uint256 newGasCost) external;

    /**
     * @notice Set the finality state for cross-chain operations
     * @dev Only callable by addresses with DEFAULT_ADMIN_ROLE
     * @param newFinalityState The new finality state
     */
    function setFinalityState(FinalityState newFinalityState) external;

    /**
     * @notice Set the MetaERC20 spoke or hub contract address
     * @dev Only callable by addresses with DEFAULT_ADMIN_ROLE
     * @param newMetaERC20SpokeOrHub The new MetaERC20 spoke or hub address
     */
    function setMetaERC20SpokeOrHub(address newMetaERC20SpokeOrHub) external;

    /**
     * @notice Set the recipient domain for cross-chain operations
     * @dev Only callable by addresses with DEFAULT_ADMIN_ROLE
     * @param newRecipientDomain The new recipient domain
     */
    function setRecipientDomain(uint32 newRecipientDomain) external;

    /**
     * @notice Burn TRUST tokens held by the contract
     * @dev Only callable by addresses with DEFAULT_ADMIN_ROLE
     * @param amount The amount of TRUST tokens to burn
     */
    function burn(uint256 amount) external;
}


// --- src/interfaces/ITrustUnlockFactory.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.29;

/**
 * @title  ITrustUnlockFactory
 * @author 0xIntuition
 * @notice Minimal interface for the TrustUnlock factory (registry)
 */
interface ITrustUnlockFactory {
    function trustToken() external view returns (address payable);
    function trustBonding() external view returns (address);
    function multiVault() external view returns (address payable);
}


// --- src/interfaces/IAtomWallet.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

/**
 * @title IAtomWallet
 * @author 0xIntuition
 * @notice The minimal interface for the AtomWallet contract - ERC-4337 compatible smart account
 * @dev AtomWallets are smart contract accounts associated with atoms in the protocol
 */
interface IAtomWallet {
    /**
     * @notice Initiates the ownership transfer over the wallet to a new owner
     * @dev Uses the two-step ownership transfer pattern for security
     * @param newOwner The new owner of the wallet (becomes the pending owner)
     */
    function transferOwnership(address newOwner) external;

    /**
     * @notice Returns the current owner of the AtomWallet
     * @return owner The address of the current owner
     */
    function owner() external view returns (address);
}


// --- src/interfaces/ISatelliteEmissionsController.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

import { FinalityState } from "src/protocol/emissions/MetaERC20Dispatcher.sol";

/**
 * @title  ISatelliteEmissionsController
 * @author 0xIntuition
 * @notice Interface for the SatelliteEmissionsController that controls the transfers of TRUST tokens from the
 * TrustBonding contract.
 */
interface ISatelliteEmissionsController {
    /* =================================================== */
    /*                       EVENTS                        */
    /* =================================================== */

    /**
     * @notice Event emitted when the TrustBonding address is updated
     * @param newTrustBonding The new TrustBonding address
     */
    event TrustBondingUpdated(address indexed newTrustBonding);

    /**
     * @notice Event emitted when the BaseEmissionsController address is updated
     * @param newBaseEmissionsController The new BaseEmissionsController address
     */
    event BaseEmissionsControllerUpdated(address indexed newBaseEmissionsController);

    /**
     * @notice Event emitted when native tokens are transferred
     * @param recipient Address that received the native tokens
     * @param amount Amount of native tokens transferred
     */
    event NativeTokenTransferred(address indexed recipient, uint256 amount);

    /**
     * @notice Event emitted when unclaimed emissions are bridged back to the BaseEmissionsController
     * @param epoch The epoch for which unclaimed emissions were bridged
     * @param amount The amount of unclaimed emissions bridged
     */
    event UnclaimedEmissionsBridged(uint256 indexed epoch, uint256 amount);

    /**
     * @notice Event emitted when unclaimed emissions are withdrawn by the admin
     * @param epoch The epoch for which unclaimed emissions were withdrawn
     * @param recipient The address that received the unclaimed emissions
     * @param amount The amount of unclaimed emissions withdrawn
     */
    event UnclaimedEmissionsWithdrawn(uint256 indexed epoch, address indexed recipient, uint256 amount);

    /* =================================================== */
    /*                       ERRORS                        */
    /* =================================================== */

    error SatelliteEmissionsController_InvalidAddress();
    error SatelliteEmissionsController_InvalidAmount();
    error SatelliteEmissionsController_InvalidBridgeAmount();
    error SatelliteEmissionsController_PreviouslyBridgedUnclaimedEmissions();
    error SatelliteEmissionsController_InsufficientBalance();
    error SatelliteEmissionsController_InsufficientGasPayment();
    error SatelliteEmissionsController_InvalidWithdrawAmount();
    error SatelliteEmissionsController_TrustBondingNotSet();

    /* =================================================== */
    /*                      GETTERS                        */
    /* =================================================== */

    /**
     * @notice Get the TrustBonding contract address
     * @return The address of the TrustBonding contract
     */
    function getTrustBonding() external view returns (address);

    /**
     * @notice Get the BaseEmissionsController contract address
     * @return The address of the BaseEmissionsController contract
     */
    function getBaseEmissionsController() external view returns (address);

    /**
     * @notice Get the amount of emissions reclaimed for a specific epoch
     * @param epoch The epoch to query
     * @return The amount of emissions reclaimed for the given epoch
     */
    function getReclaimedEmissions(uint256 epoch) external view returns (uint256);

    /* =================================================== */
    /*                    CONTROLLER                       */
    /* =================================================== */

    /**
     * @notice Transfer native tokens to a specified recipient
     * @dev Only callable by addresses with CONTROLLER_ROLE
     * @param recipient The address to transfer tokens to
     * @param amount The amount of native tokens to transfer
     */
    function transfer(address recipient, uint256 amount) external;

    /* =================================================== */
    /*                       ADMIN                         */
    /* =================================================== */

    /**
     * @notice Set the TrustBonding contract address
     * @dev Only callable by addresses with DEFAULT_ADMIN_ROLE
     * @param newTrustBonding The new TrustBonding contract address
     */
    function setTrustBonding(address newTrustBonding) external;

    /**
     * @notice Set the BaseEmissionsController contract address
     * @dev Only callable by addresses with DEFAULT_ADMIN_ROLE
     * @param newBaseEmissionsController The new BaseEmissionsController contract address
     */
    function setBaseEmissionsController(address newBaseEmissionsController) external;

    /**
     * @notice Set the message gas cost for cross-chain operations
     * @dev Only callable by addresses with DEFAULT_ADMIN_ROLE
     * @param newGasCost The new gas cost value
     */
    function setMessageGasCost(uint256 newGasCost) external;

    /**
     * @notice Set the finality state for cross-chain operations
     * @dev Only callable by addresses with DEFAULT_ADMIN_ROLE
     * @param newFinalityState The new finality state
     */
    function setFinalityState(FinalityState newFinalityState) external;

    /**
     * @notice Set the MetaERC20 spoke or hub contract address
     * @dev Only callable by addresses with DEFAULT_ADMIN_ROLE
     * @param newMetaERC20SpokeOrHub The new MetaERC20 spoke or hub address
     */
    function setMetaERC20SpokeOrHub(address newMetaERC20SpokeOrHub) external;

    /**
     * @notice Set the recipient domain for cross-chain operations
     * @dev Only callable by addresses with DEFAULT_ADMIN_ROLE
     * @param newRecipientDomain The new recipient domain
     */
    function setRecipientDomain(uint32 newRecipientDomain) external;

    /**
     * @notice Withdraw unclaimed emissions for a specific epoch to a specified recipient
     * @dev Only callable by addresses with DEFAULT_ADMIN_ROLE
     * @param epoch The epoch for which to withdraw unclaimed emissions
     * @param recipient The address to receive the unclaimed emissions
     */
    function withdrawUnclaimedEmissions(uint256 epoch, address recipient) external;

    /**
     * @notice Bridges unclaimed emissions for a specific epoch back to the BaseEmissionsController
     * @dev The SatelliteEmissionsController can only bridge unclaimed emission once the claiming period for that epoch
     * has ended, which is enforced in the TrustBonding contract. Only callable by addresses with OPERATOR_ROLE.
     * @param epoch The epoch for which to bridge unclaimed emissions
     */
    function bridgeUnclaimedEmissions(uint256 epoch) external payable;
}


// --- src/interfaces/IMultiVault.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

import {
    BondingCurveConfig,
    GeneralConfig,
    AtomConfig,
    TripleConfig,
    WalletConfig,
    VaultFees
} from "src/interfaces/IMultiVaultCore.sol";

/* =================================================== */
/*                          STRUCTS                    */
/* =================================================== */

/// @notice Vault state struct
struct VaultState {
    /// @dev Total assets held in the vault
    uint256 totalAssets;
    /// @dev Total shares issued by the vault
    uint256 totalShares;
    /// @dev Mapping of account addresses to their share balances in the vault
    mapping(address account => uint256 balance) balanceOf;
}

/* =================================================== */
/*                        ENUMS                        */
/* =================================================== */

/// @notice Enum for the approval types
/// @dev NONE = 0b00, DEPOSIT = 0b01, REDEMPTION = 0b10, BOTH = 0b11
enum ApprovalTypes {
    NONE,
    DEPOSIT,
    REDEMPTION,
    BOTH
}

/// @notice Enum for the vault types
enum VaultType {
    ATOM,
    TRIPLE,
    COUNTER_TRIPLE
}

/// @title IMultiVault
/// @author 0xIntuition
/// @notice Interface for managing many ERC4626 style vaults in a single contract
interface IMultiVault {
    /* =================================================== */
    /*                       EVENTS                        */
    /* =================================================== */

    /// @notice Emitted when a receiver changes the approval type for a sender
    ///
    /// @param sender The address of the sender being approved or disapproved
    /// @param receiver The address of the receiver granting or revoking approval
    /// @param approvalType The type of approval granted (NONE = 0, DEPOSIT = 1, REDEMPTION = 2, BOTH = 3)
    event ApprovalTypeUpdated(address indexed sender, address indexed receiver, ApprovalTypes approvalType);

    /// @notice Emitted when atom wallet deposit fees are claimed
    ///
    /// @param termId The ID of the atom
    /// @param atomWalletOwner The address of the atom wallet owner
    /// @param feesClaimed The amount of fees claimed from the atom wallet
    event AtomWalletDepositFeesClaimed(
        bytes32 indexed termId, address indexed atomWalletOwner, uint256 indexed feesClaimed
    );

    /// @notice Emitted when total utilization is added for an epoch
    ///
    /// @param epoch The epoch in which the total utilization was added
    /// @param valueAdded The value of the utilization added (in TRUST tokens)
    /// @param totalUtilization The total utilization for the epoch after adding the value
    event TotalUtilizationAdded(uint256 indexed epoch, int256 indexed valueAdded, int256 indexed totalUtilization);

    /// @notice Emitted when personal utilization is added for a user
    ///
    /// @param user The address of the user
    /// @param epoch The epoch in which the utilization was added
    /// @param valueAdded The value of the utilization added (in TRUST tokens)
    /// @param personalUtilization The personal utilization for the user after adding the value
    event PersonalUtilizationAdded(
        address indexed user, uint256 indexed epoch, int256 indexed valueAdded, int256 personalUtilization
    );

    /// @notice Emitted when total utilization is removed for an epoch
    ///
    /// @param epoch The epoch in which the total utilization was removed
    /// @param valueRemoved The value of the utilization removed (in TRUST tokens)
    /// @param totalUtilization The total utilization for the epoch after removing the value
    event TotalUtilizationRemoved(uint256 indexed epoch, int256 indexed valueRemoved, int256 indexed totalUtilization);

    /// @notice Emitted when personal utilization is removed for a user
    ///
    /// @param user The address of the user
    /// @param epoch The epoch in which the utilization was removed
    /// @param valueRemoved The value of the utilization removed (in TRUST tokens)
    /// @param personalUtilization The personal utilization for the user after removing the value
    event PersonalUtilizationRemoved(
        address indexed user, uint256 indexed epoch, int256 indexed valueRemoved, int256 personalUtilization
    );

    /// @notice Emitted when assets are deposited into a vault
    ///
    /// @param sender The address of the sender
    /// @param receiver The address of the receiver
    /// @param termId The ID of the term (atom or triple)
    /// @param curveId The ID of the bonding curve
    /// @param assets The amount of assets deposited (gross assets deposited by the sender, including atomCost or
    /// tripleCost where applicable)
    /// @param assetsAfterFees The amount of assets after all deposit fees are deducted
    /// @param shares The amount of shares minted to the receiver
    /// @param totalShares The user's share balance in the vault after the deposit
    /// @param vaultType The type of vault (ATOM, TRIPLE, or COUNTER_TRIPLE)
    event Deposited(
        address indexed sender,
        address indexed receiver,
        bytes32 indexed termId,
        uint256 curveId,
        uint256 assets,
        uint256 assetsAfterFees,
        uint256 shares,
        uint256 totalShares,
        VaultType vaultType
    );

    /// @notice Emitted when shares are redeemed from a vault
    ///
    /// @param sender The address of the sender
    /// @param receiver The address of the receiver
    /// @param termId The ID of the term (atom or triple)
    /// @param curveId The ID of the bonding curve
    /// @param shares The amount of shares redeemed
    /// @param totalShares The user's share balance in the vault after the redemption
    /// @param assets The amount of assets withdrawn (net assets received by the receiver)
    /// @param fees The amount of fees charged
    /// @param vaultType The type of vault (ATOM, TRIPLE, or COUNTER_TRIPLE)
    event Redeemed(
        address indexed sender,
        address indexed receiver,
        bytes32 indexed termId,
        uint256 curveId,
        uint256 shares,
        uint256 totalShares,
        uint256 assets,
        uint256 fees,
        VaultType vaultType
    );

    /// @notice Emitted when an atom wallet deposit fee is collected
    /// @dev The atom wallet deposit fee is charged when depositing assets into atom vaults and accumulates
    ///      as claimable fees for the atom wallet owner of the corresponding atom vault
    ///
    /// @param termId The ID of the term (atom)
    /// @param sender The address of the sender
    /// @param amount The amount of atom wallet deposit fee collected
    event AtomWalletDepositFeeCollected(bytes32 indexed termId, address indexed sender, uint256 amount);

    /// @notice Emitted when a protocol fee is accrued internally
    ///
    /// @param epoch The epoch in which the protocol fee was accrued (current epoch)
    /// @param sender The address of the user who paid the protocol fee
    /// @param amount The amount of protocol fee accrued
    event ProtocolFeeAccrued(uint256 indexed epoch, address indexed sender, uint256 amount);

    /// @notice Emitted when a protocol fee is transferred to the protocol multisig or the TrustBonding contract
    /// @dev The protocol fee is charged when depositing assets and redeeming shares from the vault, except
    ///      when the contract is paused
    ///
    /// @param epoch The epoch for which the protocol fee was transferred (previous epoch)
    /// @param destination The address of the destination (protocol multisig or TrustBonding contract)
    /// @param amount The amount of protocol fee transferred
    event ProtocolFeeTransferred(uint256 indexed epoch, address indexed destination, uint256 amount);

    /// @notice Emitted when the share price changes
    ///
    /// @param termId The ID of the term (atom or triple)
    /// @param curveId The ID of the bonding curve
    /// @param sharePrice The new share price
    /// @param totalAssets The total assets in the vault after the change
    /// @param totalShares The total shares in the vault after the change
    /// @param vaultType The type of vault (ATOM, TRIPLE, or COUNTER_TRIPLE)
    event SharePriceChanged(
        bytes32 indexed termId,
        uint256 indexed curveId,
        uint256 sharePrice,
        uint256 totalAssets,
        uint256 totalShares,
        VaultType vaultType
    );

    /// @notice Emitted when an atom vault is created
    ///
    /// @param creator The address of the creator
    /// @param termId The ID of the atom vault
    /// @param atomData The data associated with the atom
    /// @param atomWallet The address of the atom wallet associated with the atom vault
    event AtomCreated(address indexed creator, bytes32 indexed termId, bytes atomData, address atomWallet);

    /// @notice Emitted when a triple vault is created
    ///
    /// @param creator The address of the creator
    /// @param termId The ID of the triple vault
    /// @param subjectId The ID of the subject atom
    /// @param predicateId The ID of the predicate atom
    /// @param objectId The ID of the object atom
    event TripleCreated(
        address indexed creator, bytes32 indexed termId, bytes32 subjectId, bytes32 predicateId, bytes32 objectId
    );

    /* =================================================== */
    /*                        GETTERS                      */
    /* =================================================== */

    /// @notice Returns the amount of assets deposited into underlying atoms when depositing into a triple vault
    function atomDepositFractionAmount(uint256 assets) external view returns (uint256);

    /**
     * @notice Claims accumulated deposit fees for an atom wallet owner
     * @param atomId The ID of the atom to claim fees for
     */
    function claimAtomWalletDepositFees(bytes32 atomId) external;

    /**
     * @notice Computes the deterministic address of an atom wallet for a given atom ID
     * @param atomId The ID of the atom to compute the wallet address for
     * @return The computed address of the atom wallet
     */
    function computeAtomWalletAddr(bytes32 atomId) external view returns (address);

    /// @notice Returns the amount of assets that would be exchanged by the vault for a given amount of shares
    ///
    /// @param termId The ID of the term (atom or triple)
    /// @param curveId The ID of the bonding curve
    /// @param shares The amount of shares to convert to assets
    ///
    /// @return assets The amount of assets that would be exchanged for the given shares
    function convertToAssets(bytes32 termId, uint256 curveId, uint256 shares) external view returns (uint256);

    /// @notice Returns the amount of shares that would be exchanged by the vault for a given amount of assets
    ///
    /// @param termId The ID of the term (atom or triple)
    /// @param curveId The ID of the bonding curve
    /// @param assets The amount of assets to convert to shares
    ///
    /// @return shares The amount of shares that would be exchanged for the given assets
    function convertToShares(bytes32 termId, uint256 curveId, uint256 assets) external view returns (uint256);

    /// @notice Returns the current epoch
    /// @return The current epoch number
    function currentEpoch() external view returns (uint256);

    /// @notice Returns the current share price for the specified vault
    /// @dev This method is provided primarily for ERC4626 compatibility and is not called internally
    /// @param termId The ID of the term (atom or triple)
    /// @param curveId The ID of the bonding curve
    /// @return price The current share price for the specified vault
    function currentSharePrice(bytes32 termId, uint256 curveId) external view returns (uint256);

    /// @notice Returns the amount of assets that would be charged as an entry fee for a given deposit amount
    /// @dev If the vault has zero total shares, the entry fee is not applied
    /// @param assets The amount of assets to calculate the fee on
    /// @return feeAmount The amount of assets that would be charged as the entry fee
    function entryFeeAmount(uint256 assets) external view returns (uint256);

    /// @notice Returns the amount of assets that would be charged as an exit fee for a given redemption amount
    /// @dev If redeeming the shares would result in zero total shares remaining in the vault, the exit fee is not
    /// applied
    /// @param assets The amount of assets to calculate the fee on
    /// @return feeAmount The amount of assets that would be charged as the exit fee
    function exitFeeAmount(uint256 assets) external view returns (uint256);

    /**
     * @notice Returns the AtomWarden contract address
     * @return The address of the AtomWarden contract
     */
    function getAtomWarden() external view returns (address);

    /// @notice Returns the number of shares held by an account in a specific vault
    /// @param account The address of the account to query
    /// @param termId The ID of the term (atom or triple)
    /// @param curveId The ID of the bonding curve
    /// @return shares The amount of shares held by the account that can be redeemed
    function getShares(address account, bytes32 termId, uint256 curveId) external view returns (uint256);

    /**
     * @notice Returns the total system utilization for a specific epoch
     * @param epoch The epoch number to query
     * @return The total utilization value for the epoch (can be positive or negative)
     */
    function getTotalUtilizationForEpoch(uint256 epoch) external view returns (int256);

    /**
     * @notice Returns a user's utilization for a specific epoch
     * @param user The user address to query
     * @param epoch The epoch number to query
     * @return The user's utilization value (can be positive or negative)
     */
    function getUserUtilizationForEpoch(address user, uint256 epoch) external view returns (int256);

    /**
     * @notice Returns the last active epoch for a user
     * @param user The user address to query
     * @return The last epoch number in which the user had activity
     */
    function getUserLastActiveEpoch(address user) external view returns (uint256);

    /**
     * @notice Returns a user's personal utilization value from their most recent active epoch strictly before
     *         the specified epoch.
     * @dev
     * - This function walks back through the user's last three tracked active epochs and returns the utilization
     *   value from the most recent one that occurred strictly before the given `epoch`
     * - Reverts if no such epoch is tracked (i.e., user has no recorded activity before `epoch`)
     * - Reverts if called with a future epoch or while the system is in epoch 0 (the genesis epoch), since there is
     *   no prior epoch in which the user could have been active at that time
     * - Utilization values are signed integers and may be positive (net deposits) or negative (net redemptions)
     * @param user The address of the user whose utilization is being queried
     * @param epoch The epoch number to check utilization before
     * @return utilization The user's utilization value from their most recent tracked active epoch
     *         strictly before the specified `epoch`
     */
    function getUserUtilizationInEpoch(address user, uint256 epoch) external view returns (int256);

    /// @notice Returns the total assets and total shares in a vault for a given term and bonding curve
    /// @param termId The ID of the term (atom or triple)
    /// @param curveId The ID of the bonding curve
    /// @return totalAssets The total assets held in the vault
    /// @return totalShares The total shares issued by the vault
    function getVault(bytes32 termId, uint256 curveId) external view returns (uint256, uint256);

    /**
     * @notice Checks if a term (atom or triple) has been created
     * @param id The term ID to check
     * @return True if the term has been created, false otherwise
     */
    function isTermCreated(bytes32 id) external view returns (bool);

    /// @notice Returns the maximum number of shares a user can redeem from a vault
    /// @param sender The address of the user
    /// @param termId The ID of the term (atom or triple)
    /// @param curveId The ID of the bonding curve
    /// @return The maximum number of redeemable shares for the user in the vault
    function maxRedeem(address sender, bytes32 termId, uint256 curveId) external view returns (uint256);

    /// @notice Simulates the creation of an atom with an initial deposit
    /// @dev Returns the expected shares to be minted and the net assets credited after fees
    /// @param termId The ID of the atom
    /// @param assets The amount of assets the user would send
    /// @return shares The expected shares to be minted for the user
    /// @return assetsAfterFixedFees The net assets that will be added to the vault (after fixed fees, before dynamic
    /// fees)
    /// @return assetsAfterFees The net assets that will be added to the vault (after all fees)
    function previewAtomCreate(
        bytes32 termId,
        uint256 assets
    )
        external
        view
        returns (uint256 shares, uint256 assetsAfterFixedFees, uint256 assetsAfterFees);

    /// @notice Simulates a deposit of assets into a vault
    /// @dev Returns the expected shares to be minted and the net assets credited after fees
    /// @param termId The ID of the term (atom or triple)
    /// @param curveId The ID of the bonding curve
    /// @param assets The amount of assets the user would send
    /// @return shares The expected shares to be minted for the user
    /// @return assetsAfterFees The net assets that will be added to the vault (after all fees)
    function previewDeposit(
        bytes32 termId,
        uint256 curveId,
        uint256 assets
    )
        external
        view
        returns (uint256 shares, uint256 assetsAfterFees);

    /// @notice Simulates a redemption of shares from a vault
    /// @dev Returns the net assets the user would receive after fees and the shares to be burned
    /// @param termId The ID of the term (atom or triple)
    /// @param curveId The ID of the bonding curve
    /// @param shares The amount of shares the user would redeem
    /// @return assetsAfterFees The net assets that would be sent to the user (after protocol and exit fees)
    /// @return sharesUsed The shares that would be burned (returned for convenience)
    function previewRedeem(
        bytes32 termId,
        uint256 curveId,
        uint256 shares
    )
        external
        view
        returns (uint256 assetsAfterFees, uint256 sharesUsed);

    /// @notice Simulates the creation of a triple with an initial deposit
    /// @dev Returns the expected shares to be minted and the net assets credited after fees
    /// @param termId The ID of the triple
    /// @param assets The amount of assets the user would send
    /// @return shares The expected shares to be minted for the user
    /// @return assetsAfterFixedFees The net assets that will be added to the vault (after fixed fees like protocol and
    /// entry fees)
    /// @return assetsAfterFees The net assets that will be added to the vault (after all fees)
    function previewTripleCreate(
        bytes32 termId,
        uint256 assets
    )
        external
        view
        returns (uint256 shares, uint256 assetsAfterFixedFees, uint256 assetsAfterFees);

    /// @notice Returns the amount of assets that would be charged as a protocol fee for a given amount
    /// @param assets The amount of assets to calculate the fee on
    /// @return feeAmount The amount of assets that would be charged as the protocol fee
    function protocolFeeAmount(uint256 assets) external view returns (uint256);

    /* =================================================== */
    /*                        WRITES                       */
    /* =================================================== */

    /// @notice Sets the approval type for a sender to act on behalf of the receiver
    /// @param sender The address to grant or revoke approval for
    /// @param approvalType The type of approval to grant (NONE = 0, DEPOSIT = 1, REDEMPTION = 2, BOTH = 3)
    function approve(address sender, ApprovalTypes approvalType) external;

    /**
     * @notice Creates multiple atom vaults with initial deposits
     * @param atomDatas Array of atom data (metadata) for each atom to be created
     * @param assets Array of asset amounts to deposit into each atom vault
     * @return Array of atom IDs (termIds) for the created atoms
     */
    function createAtoms(
        bytes[] calldata atomDatas,
        uint256[] calldata assets
    )
        external
        payable
        returns (bytes32[] memory);

    /**
     * @notice Creates multiple triple vaults with initial deposits
     * @param subjectIds Array of atom IDs to use as subjects
     * @param predicateIds Array of atom IDs to use as predicates
     * @param objectIds Array of atom IDs to use as objects
     * @param assets Array of asset amounts to deposit into each triple vault
     * @return Array of triple IDs (termIds) for the created triples
     */
    function createTriples(
        bytes32[] calldata subjectIds,
        bytes32[] calldata predicateIds,
        bytes32[] calldata objectIds,
        uint256[] calldata assets
    )
        external
        payable
        returns (bytes32[] memory);

    /**
     * @notice Deposits assets into a vault and mints shares to the receiver
     * @param receiver Address to receive the minted shares
     * @param termId ID of the term (atom or triple) to deposit into
     * @param curveId Bonding curve ID to use for the deposit
     * @param minShares Minimum number of shares expected to be minted
     * @return Number of shares minted to the receiver
     */
    function deposit(
        address receiver,
        bytes32 termId,
        uint256 curveId,
        uint256 minShares
    )
        external
        payable
        returns (uint256);

    /**
     * @notice Deposits assets into multiple vaults in a single transaction
     * @param receiver Address to receive the minted shares
     * @param termIds Array of term IDs to deposit into
     * @param curveIds Array of bonding curve IDs to use for each deposit
     * @param assets Array of asset amounts to deposit into each vault
     * @param minShares Array of minimum shares expected for each deposit
     * @return Array of shares minted for each deposit
     */
    function depositBatch(
        address receiver,
        bytes32[] calldata termIds,
        uint256[] calldata curveIds,
        uint256[] calldata assets,
        uint256[] calldata minShares
    )
        external
        payable
        returns (uint256[] memory);

    /**
     * @notice Redeems shares from a vault and returns assets to the receiver
     * @param receiver Address to receive the redeemed assets
     * @param termId ID of the term (atom or triple) to redeem from
     * @param curveId Bonding curve ID to use for the redemption
     * @param shares Number of shares to redeem
     * @param minAssets Minimum number of assets expected to be returned
     * @return Number of assets returned to the receiver
     */
    function redeem(
        address receiver,
        bytes32 termId,
        uint256 curveId,
        uint256 shares,
        uint256 minAssets
    )
        external
        returns (uint256);

    /**
     * @notice Redeems shares from multiple vaults in a single transaction
     * @param receiver Address to receive the redeemed assets
     * @param termIds Array of term IDs to redeem from
     * @param curveIds Array of bonding curve IDs to use for each redemption
     * @param shares Array of share amounts to redeem from each vault
     * @param minAssets Array of minimum assets expected for each redemption
     * @return Array of assets returned for each redemption
     */
    function redeemBatch(
        address receiver,
        bytes32[] calldata termIds,
        uint256[] calldata curveIds,
        uint256[] calldata shares,
        uint256[] calldata minAssets
    )
        external
        returns (uint256[] memory);

    /**
     * @notice Returns the accumulated protocol fees for a specific epoch
     * @param epoch The epoch number to query
     * @return The accumulated protocol fees for the epoch
     */
    function accumulatedProtocolFees(uint256 epoch) external view returns (uint256);

    /// @notice Sweeps the accumulated protocol fees for a specified epoch to the protocol multisig
    function sweepAccumulatedProtocolFees(uint256 epoch) external;

    /// @notice Pauses the contract, preventing deposits and redemptions
    function pause() external;

    /// @notice Unpauses the contract, allowing deposits and redemptions
    function unpause() external;

    /// @notice Sets the general configuration parameters
    function setGeneralConfig(GeneralConfig memory _generalConfig) external;

    /// @notice Sets the atom configuration parameters
    function setAtomConfig(AtomConfig memory _atomConfig) external;

    /// @notice Sets the triple configuration parameters
    function setTripleConfig(TripleConfig memory _tripleConfig) external;

    /// @notice Sets the vault fee configuration parameters
    function setVaultFees(VaultFees memory _vaultFees) external;

    /// @notice Sets the wallet configuration parameters
    function setWalletConfig(WalletConfig memory _walletConfig) external;

    /// @notice Sets the bonding curve configuration parameters
    function setBondingCurveConfig(BondingCurveConfig memory _bondingCurveConfig) external;
}


// --- src/interfaces/IMetaLayer.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

struct MetaERC20DispatchInit {
    address hubOrSpoke;
    uint32 recipientDomain;
    uint256 gasLimit;
    FinalityState finalityState;
}

enum FinalityState {
    INSTANT,
    FINALIZED,
    ESPRESSO
}

interface IMetaERC20HubOrSpoke {
    function transferRemote(
        uint32 _recipientDomain,
        bytes32 _recipientAddress,
        uint256 _amount,
        uint256 _gasLimit,
        FinalityState _finalityState
    )
        external
        payable;

    function metalayerRouter() external view returns (address);
}

interface IMetalayerRouter {
    function igp() external view returns (address);
}

interface IIGP {
    function quoteGasPayment(uint32 destinationDomain, uint256 gasLimit) external view returns (uint256);
}


// --- src/interfaces/IBaseCurve.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

/**
 * @title  IBaseCurve
 * @author 0xIntuition
 * @notice Interface for bonding curves in the Intuition protocol.
 *         All curves must implement these functions to be compatible with the protocol.
 */
interface IBaseCurve {
    /* =================================================== */
    /*                      EVENTS                         */
    /* =================================================== */

    /// @notice Emitted when the curve name is set
    /// @param name The unique name of the curve
    event CurveNameSet(string name);

    /* =================================================== */
    /*                      ERRORS                         */
    /* =================================================== */

    error BaseCurve_EmptyStringNotAllowed();
    error BaseCurve_AssetsExceedTotalAssets();
    error BaseCurve_SharesExceedTotalShares();
    error BaseCurve_AssetsOverflowMax();
    error BaseCurve_SharesOverflowMax();
    error BaseCurve_DomainExceeded();

    /* =================================================== */
    /*                    FUNCTIONS                       */
    /* =================================================== */

    /// @notice Get the name of the curve
    /// @return name The name of the curve
    function name() external view returns (string memory);

    /// @notice Get the maximum number of shares the curve can handle
    /// @return The maximum number of shares
    function maxShares() external view returns (uint256);

    /// @notice Get the maximum number of assets the curve can handle
    /// @return The maximum number of assets
    function maxAssets() external view returns (uint256);

    /// @notice Preview how many shares would be minted for a deposit of assets
    /// @param assets Quantity of assets to deposit
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @return shares The number of shares that would be minted
    function previewDeposit(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares
    )
        external
        view
        returns (uint256 shares);

    /// @notice Preview how many assets would be returned for burning a specific amount of shares
    /// @param shares Quantity of shares to burn
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @return assets The number of assets that would be returned
    function previewRedeem(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets
    )
        external
        view
        returns (uint256 assets);

    /// @notice Preview how many shares would be redeemed for a withdrawal of assets
    /// @param assets Quantity of assets to withdraw
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @return shares The number of shares that would need to be redeemed
    function previewWithdraw(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares
    )
        external
        view
        returns (uint256 shares);

    /// @notice Preview how many assets would be required to mint a specific amount of shares
    /// @param shares Quantity of shares to mint
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @return assets The number of assets that would be required to mint the shares
    function previewMint(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets
    )
        external
        view
        returns (uint256 assets);

    /// @notice Convert assets to shares at a specific point on the curve
    /// @param assets Quantity of assets to convert to shares
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @return shares The number of shares equivalent to the given assets
    function convertToShares(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares
    )
        external
        view
        returns (uint256 shares);

    /// @notice Convert shares to assets at a specific point on the curve
    /// @param shares Quantity of shares to convert to assets
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @return assets The number of assets equivalent to the given shares
    function convertToAssets(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets
    )
        external
        view
        returns (uint256 assets);

    /// @notice Get the current price of a share
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @return sharePrice The current price of a share, scaled by 1e18
    function currentPrice(uint256 totalShares, uint256 totalAssets) external view returns (uint256 sharePrice);
}


// --- src/interfaces/ITrustBonding.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

struct UserInfo {
    uint256 personalUtilization;
    uint256 eligibleRewards;
    uint256 maxRewards;
    uint256 lockedAmount;
    uint256 lockEnd;
    uint256 bondedBalance;
}

/**
 * @title  ITrustBonding
 * @author 0xIntuition
 * @notice Interface for the Intuition's TrustBondingV2 contract
 */
interface ITrustBonding {
    /* =================================================== */
    /*                       EVENTS                        */
    /* =================================================== */

    /**
     * @notice Emitted when a user claims their accrued Trust rewards
     * @param user The user who claimed the rewards
     * @param recipient The address to which the rewards were sent
     * @param amount The amount of TRUST tokens minted as rewards
     */
    event RewardsClaimed(address indexed user, address indexed recipient, uint256 amount);

    /**
     * @notice Emitted when the timelock contract is set
     * @param timelock The address of the timelock contract
     */
    event TimelockSet(address indexed timelock);

    /**
     * @notice Emitted when the MultiVault contract is set
     * @param multiVault The address of the MultiVault contract
     */
    event MultiVaultSet(address indexed multiVault);

    /**
     * @notice Emitted when the SatelliteEmissionsController contract is set
     * @param satelliteEmissionsController The address of the SatelliteEmissionsController contract
     */
    event SatelliteEmissionsControllerSet(address indexed satelliteEmissionsController);

    /**
     * @notice Emitted when the lower bound for the system utilization ratio is updated
     * @param newLowerBound The new lower bound for the system utilization ratio
     */
    event SystemUtilizationLowerBoundUpdated(uint256 newLowerBound);

    /**
     * @notice Emitted when the lower bound for the personal utilization ratio is updated
     * @param newLowerBound The new lower bound for the personal utilization ratio
     */
    event PersonalUtilizationLowerBoundUpdated(uint256 newLowerBound);

    /* =================================================== */
    /*                       ERRORS                        */
    /* =================================================== */

    /// @dev Thrown when attempting to claim protocol fees that exceed the available balance
    error TrustBonding_ClaimableProtocolFeesExceedBalance();

    /// @dev Thrown when an invalid epoch number is provided
    error TrustBonding_InvalidEpoch();

    /// @dev Thrown when an invalid utilization lower bound is provided (must be between 0 and 1e18)
    error TrustBonding_InvalidUtilizationLowerBound();

    /// @dev Thrown when an invalid start timestamp is provided during initialization
    error TrustBonding_InvalidStartTimestamp();

    /// @dev Thrown when attempting to claim rewards during the first epoch
    error TrustBonding_NoClaimingDuringFirstEpoch();

    /// @dev Thrown when a user has no rewards to claim
    error TrustBonding_NoRewardsToClaim();

    /// @dev Thrown when a function is called by an address other than the timelock
    error TrustBonding_OnlyTimelock();

    /// @dev Thrown when attempting to claim rewards for an epoch that has already been claimed
    error TrustBonding_RewardsAlreadyClaimedForEpoch();

    /// @dev Thrown when a zero address is provided where a valid address is required
    error TrustBonding_ZeroAddress();

    /* =================================================== */
    /*                      FUNCTIONS                      */
    /* =================================================== */

    /**
     * @notice Initializes the TrustBonding contract
     * @param _owner The owner of the contract
     * @param _timelock The address of the timelock contract
     * @param _trustToken The address of the WTRUST token
     * @param _epochLength The length of an epoch in seconds
     * @param _satelliteEmissionsController The address of the SatelliteEmissionsController contract
     * @param _systemUtilizationLowerBound The lower bound for the system utilization ratio
     * @param _personalUtilizationLowerBound The lower bound for the personal utilization ratio
     */
    function initialize(
        address _owner,
        address _timelock,
        address _trustToken,
        uint256 _epochLength,
        address _satelliteEmissionsController,
        uint256 _systemUtilizationLowerBound,
        uint256 _personalUtilizationLowerBound
    )
        external;

    /**
     * @notice Returns the length of an epoch in seconds
     * @return The epoch length in seconds
     */
    function epochLength() external view returns (uint256);

    /**
     * @notice Returns the number of epochs per year
     * @return The number of epochs that occur in one year
     */
    function epochsPerYear() external view returns (uint256);

    /**
     * @notice Returns the timestamp when a specific epoch ends
     * @param _epoch The epoch number
     * @return The timestamp when the epoch ends
     */
    function epochTimestampEnd(uint256 _epoch) external view returns (uint256);

    /**
     * @notice Returns the epoch number for a given timestamp
     * @param timestamp The timestamp to query
     * @return The epoch number that contains the given timestamp
     */
    function epochAtTimestamp(uint256 timestamp) external view returns (uint256);

    /**
     * @notice Returns the current epoch number
     * @return The current epoch number based on block.timestamp
     */
    function currentEpoch() external view returns (uint256);

    /// @notice Returns the previous epoch number
    /// @return The previous epoch number
    function previousEpoch() external view returns (uint256);

    /// @notice Returns the amount of TRUST tokens emitted per epoch
    /// @param epoch The epoch to query
    /// @return The amount of TRUST tokens emitted in the specified epoch
    function emissionsForEpoch(uint256 epoch) external view returns (uint256);

    /**
     * @notice Returns the total amount of tokens currently locked in the system
     * @return The total locked token amount
     */
    function totalLocked() external view returns (uint256);

    /**
     * @notice Returns the current total bonded balance across all users
     * @return The total bonded balance
     */
    function totalBondedBalance() external view returns (uint256);

    /**
     * @notice Returns the total bonded balance at the end of a specific epoch
     * @param _epoch The epoch number to query
     * @return The total bonded balance at the end of the specified epoch
     */
    function totalBondedBalanceAtEpochEnd(uint256 _epoch) external view returns (uint256);

    /**
     * @notice Returns a user's bonded balance at the end of a specific epoch
     * @param _account The user's address
     * @param _epoch The epoch number to query
     * @return The user's bonded balance at the end of the specified epoch
     */
    function userBondedBalanceAtEpochEnd(address _account, uint256 _epoch) external view returns (uint256);

    /**
     * @notice Returns the amount of rewards a user is eligible for in a specific epoch
     * @param _account The user's address
     * @param _epoch The epoch number to query
     * @return The amount of rewards the user is eligible for
     */
    function userEligibleRewardsForEpoch(address _account, uint256 _epoch) external view returns (uint256);

    /**
     * @notice Checks if a user has already claimed rewards for a specific epoch
     * @param _account The user's address
     * @param _epoch The epoch number to query
     * @return True if the user has claimed rewards for the epoch, false otherwise
     */
    function hasClaimedRewardsForEpoch(address _account, uint256 _epoch) external view returns (bool);

    /**
     * @notice Returns the system utilization ratio for a specific epoch
     * @param _epoch The epoch number to query
     * @return The system utilization ratio (scaled by 1e18)
     */
    function getSystemUtilizationRatio(uint256 _epoch) external view returns (uint256);

    /**
     * @notice Returns the personal utilization ratio for a user in a specific epoch
     * @param _account The user's address
     * @param _epoch The epoch number to query
     * @return The personal utilization ratio for the user (scaled by 1e18)
     */
    function getPersonalUtilizationRatio(address _account, uint256 _epoch) external view returns (uint256);

    /**
     * @notice Returns comprehensive user information including rewards and lock details
     * @param account The user's address
     * @return UserInfo struct containing personal utilization, adjusted rewards, max rewards,
     *         locked amount, lock end, and bonded balance
     */
    function getUserInfo(address account) external view returns (UserInfo memory);

    /// @notice Returns the eligible rewards for a specific user
    /// @param account The address of the user
    /// @return The eligible rewards for the user
    function getUserCurrentClaimableRewards(address account) external view returns (uint256);

    /// @notice Returns the eligible rewards for a specific user
    /// @param account The address of the user
    /// @param epoch The epoch number to query
    /// @return eligibleRewards The total rewards the user is eligible for in the specified epoch
    /// @return maxRewards The rewards available for the user to claim in the specified epoch
    function getUserRewardsForEpoch(
        address account,
        uint256 epoch
    )
        external
        view
        returns (uint256 eligibleRewards, uint256 maxRewards);

    /**
     * @notice Returns the Annual Percentage Yield (APY) for a specific epoch
     * @return currentApy The current APY for the user in the current epoch (scaled by BASIS_POINTS)
     * @return maxApy The maximum possible APY for the user based on max utilization (scaled by BASIS_POINTS)
     */
    function getUserApy(address account) external view returns (uint256 currentApy, uint256 maxApy);

    /**
     * @notice Returns the Annual Percentage Yield (APY) for a specific epoch
     * @return currentApy The current APY for the current epoch (scaled by BASIS_POINTS)
     * @return maxApy The maximum possible APY based on max utilization (scaled by BASIS_POINTS)
     */
    function getSystemApy() external view returns (uint256 currentApy, uint256 maxApy);

    /**
     * @notice Calculates the amount of unclaimed rewards for a specific epoch.
     * @dev Can be called by anyone to determine unclaimed rewards, but used specifically by the
     * SatelliteEmissionsController to determine how much TRUST should be bridged back to the BaseEmissionsController
     * and burned.
     * @param epoch The epoch to calculate the unclaimed rewards for
     * @return claimableRewards Unclaimed rewards available for reclaiming
     */
    function getUnclaimedRewardsForEpoch(uint256 epoch) external view returns (uint256 claimableRewards);

    /**
     * @notice Claims eligible Trust token rewards. Claims are always for the previous epoch (`currentEpoch() - 1`)
     * @dev Rewards for epoch `n` are claimable in epoch `n + 1`. If the user forgets to claim their rewards for epoch
     * `n`, they are effectively forfeited. Note that the user is free to claim their rewards to any address they
     * choose.
     * @param recipient The address to receive the Trust rewards
     */
    function claimRewards(address recipient) external;

    /**
     * @notice Pauses the contract, preventing certain operations
     * @dev Can only be called by the PAUSER_ROLE
     */
    function pause() external;

    /**
     * @notice Unpauses the contract, allowing all operations to resume
     * @dev Can only be called by the DEFAULT_ADMIN_ROLE
     */
    function unpause() external;

    /**
     * @notice Sets the timelock contract address
     * @param _timelock The address of the timelock contract
     * @dev Can only be called by the timelock. Reverts if _timelock is the zero address
     */
    function setTimelock(address _timelock) external;

    /**
     * @notice Sets the MultiVault contract address
     * @param _multiVault The address of the MultiVault contract
     * @dev Can only be called by the timelock. Reverts if _multiVault is the zero address
     */
    function setMultiVault(address _multiVault) external;

    /**
     * @notice Updates the lower bound for the system utilization ratio
     * @param newLowerBound The new lower bound for the system utilization ratio (must be between 0 and 1e18)
     * @dev Can only be called by the timelock. Reverts if newLowerBound is invalid
     */
    function updateSystemUtilizationLowerBound(uint256 newLowerBound) external;

    /**
     * @notice Updates the lower bound for the personal utilization ratio
     * @param newLowerBound The new lower bound for the personal utilization ratio (must be between 0 and 1e18)
     * @dev Can only be called by the timelock. Reverts if newLowerBound is invalid
     */
    function updatePersonalUtilizationLowerBound(uint256 newLowerBound) external;

    /**
     * @notice Updates the SatelliteEmissionsController contract address
     * @param _satelliteEmissionsController The address of the SatelliteEmissionsController contract
     * @dev Can only be called by the timelock. Reverts if _satelliteEmissionsController is the zero address
     */
    function updateSatelliteEmissionsController(address _satelliteEmissionsController) external;
}


// --- src/interfaces/IAtomWarden.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

/**
 * @title IAtomWarden
 * @author 0xIntuition
 * @notice Interface for the AtomWarden contract
 */
interface IAtomWarden {
    /* =================================================== */
    /*                       EVENTS                        */
    /* =================================================== */

    /**
     * @notice Event emitted when the MultiVault contract address is set
     * @param multiVault MultiVault contract address
     */
    event MultiVaultSet(address multiVault);

    /**
     * @notice Event emitted when ownership transfer over an atom wallet has been claimed
     * @param atomId The atom ID
     * @param pendingOwner The address of the pending owner
     */
    event AtomWalletOwnershipClaimed(bytes32 atomId, address pendingOwner);

    /* =================================================== */
    /*                       ERRORS                        */
    /* =================================================== */

    error AtomWarden_InvalidAddress();
    error AtomWarden_AtomIdDoesNotExist();
    error AtomWarden_ClaimOwnershipFailed();
    error AtomWarden_AtomWalletNotDeployed();
    error AtomWarden_InvalidNewOwnerAddress();

    /* =================================================== */
    /*                      FUNCTIONS                      */
    /* =================================================== */

    /**
     * @notice Allows the caller to claim ownership over an atom wallet address in case
     *         atomUri is equal to the caller's address
     * @param atomId The atom ID
     */
    function claimOwnershipOverAddressAtom(bytes32 atomId) external;

    /**
     * @notice Allows the owner to assign ownership of an atom wallet to a new owner in
     *         cases where the automated ownership recovery is not possible yet
     * @param atomId The atom ID
     * @param newOwner The new owner address
     */
    function claimOwnership(bytes32 atomId, address newOwner) external;

    /**
     * @notice Sets the MultiVault contract address
     * @param _multiVault MultiVault contract address
     */
    function setMultiVault(address _multiVault) external;
}


// --- src/interfaces/ICoreEmissionsController.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

/**
 * @dev Initialization parameters for CoreEmissionsController
 * @param startTimestamp The timestamp when emissions begin
 * @param emissionsLength The length of each epoch in seconds
 * @param emissionsPerEpoch The base amount of TRUST tokens emitted per epoch
 * @param emissionsReductionCliff The number of epochs between emissions reductions
 * @param emissionsReductionBasisPoints The reduction percentage in basis points (100 = 1%)
 */
struct CoreEmissionsControllerInit {
    uint256 startTimestamp;
    uint256 emissionsLength;
    uint256 emissionsPerEpoch;
    uint256 emissionsReductionCliff;
    uint256 emissionsReductionBasisPoints;
}

/**
 * @dev Emissions checkpoint structure containing all emissions parameters
 * @param startTimestamp The timestamp when emissions begin
 * @param emissionsLength The length of each epoch in seconds
 * @param emissionsPerEpoch The base amount of TRUST tokens emitted per epoch
 * @param emissionsReductionCliff The number of epochs between emissions reductions
 * @param emissionsReductionBasisPoints The reduction percentage in basis points (100 = 1%)
 * @param retentionFactor The factor used to calculate reduced emissions (10000 - reductionBasisPoints)
 */
struct EmissionsCheckpoint {
    uint256 startTimestamp;
    uint256 emissionsLength;
    uint256 emissionsPerEpoch;
    uint256 emissionsReductionCliff;
    uint256 emissionsReductionBasisPoints;
    uint256 retentionFactor;
}

/**
 * @title ICoreEmissionsController
 * @author 0xIntuition
 * @notice Interface for the CoreEmissionsController that manages TRUST token emissions
 */
interface ICoreEmissionsController {
    /* =================================================== */
    /*                       EVENTS                        */
    /* =================================================== */

    /**
     * @dev Emitted when the CoreEmissionsController is initialized
     * @param startTimestamp The timestamp when emissions begin
     * @param emissionsLength The length of each epoch in seconds
     * @param emissionsPerEpoch The base amount of TRUST tokens emitted per epoch
     * @param emissionsReductionCliff The number of epochs between emissions reductions
     * @param emissionsReductionBasisPoints The reduction percentage in basis points
     */
    event Initialized(
        uint256 startTimestamp,
        uint256 emissionsLength,
        uint256 emissionsPerEpoch,
        uint256 emissionsReductionCliff,
        uint256 emissionsReductionBasisPoints
    );

    /* =================================================== */
    /*                       ERRORS                        */
    /* =================================================== */

    /// @notice Thrown when reduction basis points exceed the maximum allowed value
    error CoreEmissionsController_InvalidReductionBasisPoints();

    /// @notice Thrown when cliff value is zero or exceeds 365 epochs
    error CoreEmissionsController_InvalidCliff();

    /// @notice Thrown when the start timestamp is in the past
    error CoreEmissionsController_InvalidTimestampStart();

    /// @notice Thrown when emissions per epoch is zero
    error CoreEmissionsController_InvalidEmissionsPerEpoch();

    /* =================================================== */
    /*                      GETTERS                        */
    /* =================================================== */

    /**
     * @notice Returns the timestamp when emissions started
     * @return The start timestamp of the emissions schedule
     */
    function getStartTimestamp() external view returns (uint256);

    /**
     * @notice Returns the length of each epoch in seconds
     * @return The epoch length in seconds
     */
    function getEpochLength() external view returns (uint256);

    /**
     * @notice Returns the current epoch number based on the current block timestamp
     * @return The current epoch number
     */
    function getCurrentEpoch() external view returns (uint256);

    /**
     * @notice Returns the start timestamp of the current epoch
     * @return The timestamp when the current epoch started
     */
    function getCurrentEpochTimestampStart() external view returns (uint256);

    /**
     * @notice Returns the emissions amount for the current epoch
     * @return The amount of TRUST tokens to emit for the current epoch
     */
    function getCurrentEpochEmissions() external view returns (uint256);

    /**
     * @notice Returns the start timestamp for a given epoch number
     * @param epochNumber The epoch number to query
     * @return The timestamp when the epoch starts
     */
    function getEpochTimestampStart(uint256 epochNumber) external view returns (uint256);

    /**
     * @notice Returns the end timestamp for a given epoch number
     * @param epochNumber The epoch number to query
     * @return The timestamp when the epoch ends
     */
    function getEpochTimestampEnd(uint256 epochNumber) external view returns (uint256);

    /**
     * @notice Returns the epoch number for a given timestamp
     * @param timestamp The timestamp to query
     * @return The epoch number corresponding to the timestamp
     */
    function getEpochAtTimestamp(uint256 timestamp) external view returns (uint256);

    /**
     * @notice Returns the number of TRUST tokens to be emitted for a given epoch
     * @param epochNumber The epoch number to query
     * @return The amount of TRUST tokens to emit for the epoch
     */
    function getEmissionsAtEpoch(uint256 epochNumber) external view returns (uint256);

    /// @notice Returns the number of TRUST tokens to be emitted at a given timestamp
    /// @param timestamp The timestamp to query
    /// @return The amount of TRUST tokens to emit at the timestamp
    function getEmissionsAtTimestamp(uint256 timestamp) external view returns (uint256);
}


// --- src/interfaces/ITrust.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

/**
 * @title ITrust
 * @author 0xIntuition
 * @notice The minimal interface for the Trust token contract.
 */
interface ITrust {
    /* =================================================== */
    /*                       EVENTS                        */
    /* =================================================== */

    /// @notice Emitted when the BaseEmissionsController address is set
    /// @param newBaseEmissionsController The new BaseEmissionsController address
    event BaseEmissionsControllerSet(address indexed newBaseEmissionsController);

    /* =================================================== */
    /*                       ERRORS                        */
    /* =================================================== */

    /// @notice Custom error for when a zero address is provided
    error Trust_ZeroAddress();

    /// @notice Custom error for when the caller is not the BaseEmissionsController
    error Trust_OnlyBaseEmissionsController();

    /* =================================================== */
    /*                     FUNCTIONS                       */
    /* =================================================== */

    /**
     * @notice Sets the BaseEmissionsController contract address
     * @param newBaseEmissionsController The new BaseEmissionsController address
     */
    function setBaseEmissionsController(address newBaseEmissionsController) external;

    /**
     * @notice Mint new TRUST tokens to an address
     * @param to Address to mint to
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external;

    /**
     * @notice Burn TRUST tokens from the caller's address
     * @dev Caller must have enough balance to burn and can only burn their own tokens
     * @param amount Amount to burn
     */
    function burn(uint256 amount) external;
}


// --- src/interfaces/IBondingCurveRegistry.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

/**
 * @title  IBondingCurveRegistry
 * @author 0xIntuition
 * @notice Interface for the BondingCurveRegistry contract. Routes access to the curves associated with atoms & triples.
 */
interface IBondingCurveRegistry {
    /* =================================================== */
    /*                    EVENTS                           */
    /* =================================================== */

    /// @notice Emitted when a new curve is added to the registry
    ///
    /// @param curveId The ID of the curve
    /// @param curveAddress The address of the curve
    /// @param curveName The name of the curve
    event BondingCurveAdded(uint256 indexed curveId, address indexed curveAddress, string indexed curveName);

    /* =================================================== */
    /*                    FUNCTIONS                        */
    /* =================================================== */

    /// @notice Preview how many shares would be minted for a deposit of assets
    /// @param assets Quantity of assets to deposit
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @param id Curve ID to use for the calculation
    /// @return shares The number of shares that would be minted
    function previewDeposit(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares,
        uint256 id
    )
        external
        view
        returns (uint256 shares);

    /// @notice Preview how many assets would be returned for burning a specific amount of shares
    /// @param shares Quantity of shares to burn
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @param id Curve ID to use for the calculation
    /// @return assets The number of assets that would be returned
    function previewRedeem(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets,
        uint256 id
    )
        external
        view
        returns (uint256 assets);

    /// @notice Preview how many shares would be redeemed for a withdrawal of assets
    /// @param assets Quantity of assets to withdraw
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @param id Curve ID to use for the calculation
    /// @return shares The number of shares that would need to be redeemed
    function previewWithdraw(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares,
        uint256 id
    )
        external
        view
        returns (uint256 shares);

    /// @notice Preview how many assets would be required to mint a specific amount of shares
    /// @param shares Quantity of shares to mint
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @param id Curve ID to use for the calculation
    /// @return assets The number of assets that would be required to mint the shares
    function previewMint(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets,
        uint256 id
    )
        external
        view
        returns (uint256 assets);

    /// @notice Convert assets to shares at a specific point on the curve
    /// @param assets Quantity of assets to convert to shares
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @param id Curve ID to use for the calculation
    /// @return shares The number of shares equivalent to the given assets
    function convertToShares(
        uint256 assets,
        uint256 totalAssets,
        uint256 totalShares,
        uint256 id
    )
        external
        view
        returns (uint256 shares);

    /// @notice Convert shares to assets at a specific point on the curve
    /// @param shares Quantity of shares to convert to assets
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @param id Curve ID to use for the calculation
    /// @return assets The number of assets equivalent to the given shares
    function convertToAssets(
        uint256 shares,
        uint256 totalShares,
        uint256 totalAssets,
        uint256 id
    )
        external
        view
        returns (uint256 assets);

    /// @notice Get the current price of a share
    /// @param id Curve ID to use for the calculation
    /// @param totalShares Total quantity of shares already awarded by the curve
    /// @param totalAssets Total quantity of assets already staked into the curve
    /// @return sharePrice The current price of a share
    function currentPrice(
        uint256 id,
        uint256 totalShares,
        uint256 totalAssets
    )
        external
        view
        returns (uint256 sharePrice);

    /// @notice Get the name of a curve
    /// @param id Curve ID to query
    /// @return name The name of the curve
    function getCurveName(uint256 id) external view returns (string memory name);

    /// @notice Get the maximum number of shares a curve can handle
    /// @param id Curve ID to query
    /// @return maxShares The maximum number of shares
    function getCurveMaxShares(uint256 id) external view returns (uint256 maxShares);

    /// @notice Get the maximum number of assets a curve can handle
    /// @param id Curve ID to query
    /// @return maxAssets The maximum number of assets
    function getCurveMaxAssets(uint256 id) external view returns (uint256 maxAssets);

    /// @notice Get the number of curves registered in the registry
    /// @return count The number of curves registered
    function count() external view returns (uint256);

    /// @notice Get the curve address for a given ID
    /// @param id The curve ID to query
    /// @return The address of the curve
    function curveAddresses(uint256 id) external view returns (address);

    /// @notice Get the curve ID for a given address
    /// @param curve The curve address to query
    /// @return The ID of the curve
    function curveIds(address curve) external view returns (uint256);

    /// @notice Get whether or not a given curve name is registered
    /// @param name The curve name to query
    /// @return True if the curve name is registered, false otherwise
    function registeredCurveNames(string memory name) external view returns (bool);

    /// @notice Check if a curve ID is valid
    /// @param id Curve ID to check
    /// @return valid True if the curve ID is valid, false otherwise
    function isCurveIdValid(uint256 id) external view returns (bool valid);
}


// --- src/interfaces/ITrustUnlock.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

/**
 * @title  ITrustUnlock
 * @author 0xIntuition
 * @notice A shared interface for the Intuition's Trust vesting and unlock contracts
 */
interface ITrustUnlock {
    /* =================================================== */
    /*                       EVENTS                        */
    /* =================================================== */

    /**
     * @notice Emitted when the bondedAmount is updated in the TrustVestingAndUnlock contract
     * @param newBondedAmount The new bonded amount
     */
    event BondedAmountUpdated(uint256 indexed newBondedAmount);
}


// --- src/interfaces/IMultiVaultCore.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

import { VaultType } from "src/interfaces/IMultiVault.sol";

/// @notice General configuration struct
struct GeneralConfig {
    /// @dev The admin address
    address admin;
    /// @dev The protocol multisig address
    address protocolMultisig;
    /// @dev The fee denominator used for fee calculations: fees are calculated as `amount * (fee / feeDenominator)`
    uint256 feeDenominator;
    /// @dev The address of the TrustBonding contract
    address trustBonding;
    /// @dev The minimum amount of assets that must be deposited into an atom or triple vault
    uint256 minDeposit;
    /// @dev The number of shares minted to the zero address upon vault creation to initialize the vault
    uint256 minShare;
    /// @dev The maximum length of atom data that can be passed when creating atom vaults
    uint256 atomDataMaxLength;
    /// @dev Threshold in terms of total shares in a default curve vault at which entry and exit fees start to be
    /// charged
    uint256 feeThreshold;
}

/// @notice Atom configuration struct
struct AtomConfig {
    /// @dev The fee paid to the protocol when depositing vault shares for atom vault creation
    uint256 atomCreationProtocolFee;
    /// @dev The portion of the deposit amount used to collect assets for the associated atom wallet
    uint256 atomWalletDepositFee;
}

/// @notice Triple configuration struct
struct TripleConfig {
    /// @dev The fee paid to the protocol when depositing vault shares for triple vault creation
    uint256 tripleCreationProtocolFee;
    /// @dev The percentage of the triple deposit amount used to purchase equity in the underlying atoms
    uint256 atomDepositFractionForTriple;
}

/// @notice Atom wallet configuration struct
struct WalletConfig {
    /// @dev The EntryPoint contract address used for ERC-4337 atom accounts
    address entryPoint;
    /// @dev The AtomWarden address, which is the initial owner of all atom accounts
    address atomWarden;
    /// @dev The UpgradeableBeacon contract address that points to the AtomWallet implementation
    address atomWalletBeacon;
    /// @dev The AtomWalletFactory contract address used to create new atom wallets
    address atomWalletFactory;
}

/// @notice Vault fees struct
struct VaultFees {
    /// @dev Entry fees charged when depositing assets into the vault; they remain in the vault as assets
    ///      rather than being used to mint shares for the recipient
    uint256 entryFee;
    /// @dev Exit fees charged when redeeming shares from the vault; they remain in the vault as assets
    ///      rather than being sent to the receiver
    uint256 exitFee;
    /// @dev Protocol fees charged when depositing assets and redeeming shares from the vault;
    ///      they are sent to the protocol multisig address as defined in `generalConfig.protocolMultisig`
    uint256 protocolFee;
}

/// @notice Bonding curve configuration struct
struct BondingCurveConfig {
    /// @dev The BondingCurveRegistry contract address (must not be changed after initialization)
    address registry;
    /// @dev The default bonding curve ID to use for new terms (ID '1' is suggested for the linear curve)
    uint256 defaultCurveId;
}

/// @title IMultiVaultCore
/// @author 0xIntuition
/// @notice Interface for the MultiVaultCore contract
interface IMultiVaultCore {
    /* =================================================== */
    /*                    EVENTS                           */
    /* =================================================== */

    /**
     * @notice Emitted when the general configuration is updated
     * @param admin The new admin address
     * @param protocolMultisig The new protocol multisig address
     * @param feeDenominator The new fee denominator
     * @param trustBonding The new TrustBonding contract address
     * @param minDeposit The new minimum deposit amount
     * @param minShare The new minimum share amount
     * @param atomDataMaxLength The new maximum atom data length
     * @param feeThreshold The new fee threshold
     */
    event GeneralConfigUpdated(
        address indexed admin,
        address indexed protocolMultisig,
        uint256 feeDenominator,
        address indexed trustBonding,
        uint256 minDeposit,
        uint256 minShare,
        uint256 atomDataMaxLength,
        uint256 feeThreshold
    );

    /**
     * @notice Emitted when the atom configuration is updated
     * @param atomCreationProtocolFee The new atom creation protocol fee
     * @param atomWalletDepositFee The new atom wallet deposit fee
     */
    event AtomConfigUpdated(uint256 atomCreationProtocolFee, uint256 atomWalletDepositFee);

    /**
     * @notice Emitted when the triple configuration is updated
     * @param tripleCreationProtocolFee The new triple creation protocol fee
     * @param atomDepositFractionForTriple The new atom deposit fraction for triple
     */
    event TripleConfigUpdated(uint256 tripleCreationProtocolFee, uint256 atomDepositFractionForTriple);

    /**
     * @notice Emitted when the wallet configuration is updated
     * @param entryPoint The new EntryPoint contract address
     * @param atomWarden The new AtomWarden contract address
     * @param atomWalletBeacon The new AtomWallet beacon address
     * @param atomWalletFactory The new AtomWallet factory address
     */
    event WalletConfigUpdated(
        address indexed entryPoint,
        address indexed atomWarden,
        address indexed atomWalletBeacon,
        address atomWalletFactory
    );

    /**
     * @notice Emitted when the vault fees configuration is updated
     * @param entryFee The new entry fee
     * @param exitFee The new exit fee
     * @param protocolFee The new protocol fee
     */
    event VaultFeesUpdated(uint256 entryFee, uint256 exitFee, uint256 protocolFee);

    /**
     * @notice Emitted when the bonding curve configuration is updated
     * @param registry The new BondingCurveRegistry contract address
     * @param defaultCurveId The new default bonding curve ID
     */
    event BondingCurveConfigUpdated(address indexed registry, uint256 defaultCurveId);

    /* =================================================== */
    /*                    INITIALIZER                      */
    /* =================================================== */

    /**
     * @notice Initializes the MultiVaultCore contract with configuration parameters
     * @param _generalConfig General configuration settings including admin addresses and protocol parameters
     * @param _atomConfig Configuration specific to atom vault creation and fees
     * @param _tripleConfig Configuration specific to triple vault creation and deposits
     * @param _walletConfig Configuration for ERC-4337 atom wallet setup
     * @param _vaultFees Fee configuration for entry, exit, and protocol fees
     * @param _bondingCurveConfig Bonding curve registry and default curve settings
     */
    function initialize(
        GeneralConfig memory _generalConfig,
        AtomConfig memory _atomConfig,
        TripleConfig memory _tripleConfig,
        WalletConfig memory _walletConfig,
        VaultFees memory _vaultFees,
        BondingCurveConfig memory _bondingCurveConfig
    )
        external;

    /* =================================================== */
    /*                      GETTERS                        */
    /* =================================================== */

    /**
     * @notice Retrieves the atom data for a given atom ID
     * @param atomId The ID of the atom to retrieve data for
     * @return The atom data for the specified atom ID
     */
    function atom(bytes32 atomId) external view returns (bytes memory);

    /// @notice Calculates the atom ID from the atom data
    /// @param data The data of the atom
    function calculateAtomId(bytes memory data) external pure returns (bytes32 id);

    /// @notice Calculates the counter triple ID from the subject, predicate, and object atom IDs
    /// @param subjectId The ID of the subject atom
    /// @param predicateId The ID of the predicate atom
    /// @param objectId The ID of the object atom
    /// @return id The calculated counter triple ID
    function calculateCounterTripleId(
        bytes32 subjectId,
        bytes32 predicateId,
        bytes32 objectId
    )
        external
        pure
        returns (bytes32);

    /// @notice Calculates the triple ID from the subject, predicate, and object atom IDs
    /// @param subjectId The ID of the subject atom
    /// @param predicateId The ID of the predicate atom
    /// @param objectId The ID of the object atom
    /// @return id The calculated triple ID
    function calculateTripleId(bytes32 subjectId, bytes32 predicateId, bytes32 objectId) external pure returns (bytes32);

    /// @notice Returns the atom data for a given atom ID
    /// @dev If the atom does not exist, this function reverts
    function getAtom(bytes32 atomId) external view returns (bytes memory data);

    /**
     * @notice Returns the atom configuration settings
     * @return AtomConfig struct containing atom creation fees and wallet deposit fee settings
     */
    function getAtomConfig() external view returns (AtomConfig memory);

    /// @notice Returns the static costs required to create an atom
    /// @return atomCost The static costs of creating an atom
    function getAtomCost() external view returns (uint256);

    /**
     * @notice Returns the bonding curve configuration
     * @return BondingCurveConfig struct containing registry address and default curve ID
     */
    function getBondingCurveConfig() external view returns (BondingCurveConfig memory);

    /// @notice Returns the counter ID from the given triple ID
    /// @param tripleId The ID of the triple
    /// @return counterId The counter vault ID for the given triple ID
    function getCounterIdFromTripleId(bytes32 tripleId) external pure returns (bytes32);

    /**
     * @notice Returns the general configuration settings
     * @return GeneralConfig struct containing admin addresses, protocol parameters, and system limits
     */
    function getGeneralConfig() external view returns (GeneralConfig memory);

    /// @notice Returns the inverse triple ID (counter or positive) for a given triple ID
    /// @param tripleId The ID of the triple or counter triple
    /// @return The inverse triple ID
    function getInverseTripleId(bytes32 tripleId) external view returns (bytes32);

    /// @notice Returns the underlying atom IDs for a given triple ID
    /// @dev If the triple does not exist, this function reverts
    /// @param tripleId The ID of the triple
    function getTriple(bytes32 tripleId) external view returns (bytes32, bytes32, bytes32);

    /**
     * @notice Returns the triple configuration settings
     * @return TripleConfig struct containing triple creation fees and atom deposit configuration
     */
    function getTripleConfig() external view returns (TripleConfig memory);

    /// @notice Returns the static costs required to create a triple
    /// @return tripleCost The static costs of creating a triple
    function getTripleCost() external view returns (uint256);

    /// @notice Returns the triple ID from the given counter ID
    /// @param counterId The ID of the counter triple
    /// @return tripleId The triple vault ID for the given counter ID
    function getTripleIdFromCounterId(bytes32 counterId) external view returns (bytes32);

    /**
     * @notice Returns the vault fees configuration
     * @return VaultFees struct containing entry, exit, and protocol fee settings
     */
    function getVaultFees() external view returns (VaultFees memory);

    /// @notice Returns the vault type for a given term ID
    /// @param termId The term ID to check
    /// @return vaultType The type of vault (ATOM, TRIPLE, or COUNTER_TRIPLE)
    function getVaultType(bytes32 termId) external view returns (VaultType);

    /**
     * @notice Returns the wallet configuration settings for ERC-4337 compatibility
     * @return WalletConfig struct containing EntryPoint, AtomWarden, AtomWallet beacon and AtomWallet factory addresses
     */
    function getWalletConfig() external view returns (WalletConfig memory);

    /**
     * @notice Checks if a term ID corresponds to an atom vault
     * @param atomId The term ID to check
     * @return True if the term ID is an atom, false otherwise
     */
    function isAtom(bytes32 atomId) external view returns (bool);

    /// @notice Returns whether the supplied vault ID is a counter triple
    /// @param termId The ID of the term (atom or triple) to check
    /// @return Whether the supplied term ID is a counter triple
    function isCounterTriple(bytes32 termId) external view returns (bool);

    /**
     * @notice Checks if a term ID corresponds to a triple vault
     * @param id The term ID to check
     * @return True if the term ID is a triple, false otherwise
     */
    function isTriple(bytes32 id) external view returns (bool);

    /// @notice Returns the underlying atom IDs for a given triple ID
    /// @dev If the triple does not exist, this function returns (bytes32(0), bytes32(0), bytes32(0)) instead of
    /// reverting
    /// @param tripleId The ID of the triple
    function triple(bytes32 tripleId) external view returns (bytes32, bytes32, bytes32);

    /**
     * @notice Returns the wallet configuration for ERC-4337 compatibility
     * @return entryPoint The EntryPoint contract address for ERC-4337
     * @return atomWarden The AtomWarden contract address
     * @return atomWalletBeacon The UpgradeableBeacon contract address for AtomWallets
     * @return atomWalletFactory The AtomWalletFactory contract address
     */
    function walletConfig()
        external
        view
        returns (address entryPoint, address atomWarden, address atomWalletBeacon, address atomWalletFactory);
}


// --- src/interfaces/IAtomWalletFactory.sol ---
// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.29;

import { IMultiVault } from "src/interfaces/IMultiVault.sol";

/**
 * @title IAtomWalletFactory
 * @author 0xIntuition
 * @notice The interface for the AtomWalletFactory contract
 */
interface IAtomWalletFactory {
    /* =================================================== */
    /*                       EVENTS                        */
    /* =================================================== */

    /// @notice Emitted when the atom wallet is deployed
    ///
    /// @param atomId atom id of the atom vault
    /// @param atomWallet address of the atom wallet associated with the atom vault
    event AtomWalletDeployed(bytes32 indexed atomId, address atomWallet);

    /* =================================================== */
    /*                   WRITE FUNCTIONS                   */
    /* =================================================== */

    /**
     * @notice Deploys a new AtomWallet for the given atom ID
     * @param atomId The ID of the atom to deploy a wallet for
     * @return The address of the newly deployed AtomWallet
     */
    function deployAtomWallet(bytes32 atomId) external returns (address);

    /* =================================================== */
    /*                   VIEW FUNCTIONS                    */
    /* =================================================== */

    /**
     * @notice Returns the MultiVault contract address
     * @return The MultiVault contract instance
     */
    function multiVault() external view returns (address);

    /**
     * @notice Computes the deterministic address of an AtomWallet for a given atom ID
     * @param atomId The ID of the atom
     * @return The computed address where the AtomWallet would be deployed
     */
    function computeAtomWalletAddr(bytes32 atomId) external view returns (address);
}
