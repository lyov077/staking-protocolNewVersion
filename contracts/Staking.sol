// SPDX-License-Identifier: MIT

pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";

contract Staking is Ownable {
    using SafeERC20 for IERC20;

    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
    }

    uint256 public accRewardPerShare;
    uint256 public rewardPerBlock;
    uint256 public lastRewardBlock;
    uint256 public totalStaked;
    mapping(address => UserInfo) public userInfo;

    IERC20 public token;
    IERC20 public stakedToken;
    IUniswapV2Router02 public router;

    event Stake(address indexed user, uint256 amount);
    event Claim(address indexed user, uint256 amount);
    event UnStaked(address indexed user, uint256 amount);

    constructor(
        IERC20 _stakedToken,
        uint256 _rewardPerBlock,
        IERC20 _token
    ) {
        stakedToken = _stakedToken;
        rewardPerBlock = _rewardPerBlock;
        token = IERC20(_token);
        router = IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    }

    function stake(uint256 _amount) external {
        distributeReward();
        stakedToken.safeTransferFrom(msg.sender, address(this), _amount);
        _stake(_amount);
    }

    function claim() external {
        UserInfo storage user = userInfo[msg.sender];
        distributeReward();
        _claim();
        user.rewardDebt = (user.amount * accRewardPerShare) / 1e12;
    }

    function unStake(uint256 _amount) external {
        UserInfo memory user = userInfo[msg.sender];
        require(user.amount >= _amount, "Staking::bad action");
        distributeReward();
        _unStake(_amount);
    }

    function pendingReward() external view returns (uint256) {
        UserInfo memory user = userInfo[msg.sender];
        return
            (user.amount * (accRewardPerShare +(getReward(lastRewardBlock, block.number) * 1e12) /totalStaked)) /
            1e12 -
            user.rewardDebt;
    }

    function setRewardPerBlock(uint256 _rewardPerBlock) external onlyOwner {
        distributeReward();
        rewardPerBlock = _rewardPerBlock;
    }

    function getReward(uint256 _from, uint256 _to)
        public
        view
        returns (uint256)
    {
        return rewardPerBlock * (_to - _from);
    }

    function distributeReward() public {
        if (block.number < lastRewardBlock) {
            return;
        }

        if (totalStaked == 0) {
            lastRewardBlock = block.number;
            return;
        }

        accRewardPerShare =
            accRewardPerShare +
            (getReward(lastRewardBlock, block.number) * 1e12) /
            totalStaked;
        lastRewardBlock = block.number;
    }

    function _stake(uint256 _amount) private {
        UserInfo storage user = userInfo[msg.sender];
        _claim();
        user.amount += _amount;
        totalStaked += _amount;
        user.rewardDebt = (user.amount * accRewardPerShare) / 1e12;
        emit Stake(msg.sender, _amount);
    }

    function _claim() private {
        UserInfo storage user = userInfo[msg.sender];
        uint256 pending = (user.amount * accRewardPerShare) /
            1e12 -
            user.rewardDebt;

        _safeRewardTransfer(msg.sender, pending);

        emit Claim(msg.sender, pending);
    }

    function _unStake(uint256 _amount) private {
        UserInfo storage user = userInfo[msg.sender];
        _claim();
        user.amount -= _amount;
        totalStaked -= _amount;
        user.rewardDebt = (user.amount * accRewardPerShare) / 1e12;
        stakedToken.safeTransfer(msg.sender, _amount);
        emit UnStaked(msg.sender, _amount);
    }

    function _safeRewardTransfer(address _to, uint256 _amount) private {
        uint256 balance = stakedToken.balanceOf(address(this)) - totalStaked;
        if (_amount > balance) {
            stakedToken.safeTransfer(_to, balance);
            return;
        }

        stakedToken.safeTransfer(_to, _amount);
    }

    function speedStake(
        uint256 _amountOutMin,
        uint256 _deadline,
        uint256 _amountTokenMin,
        uint256 _amountETHMin
    ) external payable {
        distributeReward();
        uint256[] memory amounts;
        address[] memory path = new address[](2);
        path[0] = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
        path[1] = address(token);
        amounts = router.swapExactETHForTokens{value: msg.value / 2}(
            _amountOutMin,
            path,
            address(this),
            _deadline
        );
        token.approve(address(router), amounts[1]);

        (, , uint256 liquidity) = router.addLiquidityETH{value: msg.value / 2}(
            address(token),
            amounts[1],
            _amountTokenMin,
            _amountETHMin,
            address(this),
            _deadline
        );
        _stake(liquidity);
    }
}
