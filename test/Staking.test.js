const {
    expect
} = require("chai");
const {
    ethers,
    deployments
} = require("hardhat");

async function advanceBlock() {
    return ethers.provider.send("evm_mine", [])
}

async function advanceBlockTo(blockNumber) {
    let currentBlock = await ethers.provider.getBlockNumber();
    for (let i = currentBlock; i < currentBlock + blockNumber; i++) {
        await advanceBlock()
    }
}

describe("Staking contract: ", function () {
    const rewardPerBlock = ethers.utils.parseEther("1");
    const routerAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
    const factoryAddress = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
    const wethAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    let staking, token, router, factory, accounts;

    before("Before: ", async () => {
        accounts = await ethers.getNamedSigners()

        await deployments.deploy("ClassToken", {
            from: accounts.deployer.address,
            log: false,
        });

        token = await ethers.getContract("ClassToken");

        router = await ethers.getContractAt("IUniswapV2Router02", routerAddress);
        factory = await ethers.getContractAt("IUniswapV2Factory", factoryAddress);

        await token.approve(routerAddress, ethers.utils.parseEther("1"));
        tx = await router.addLiquidityETH(token.address, ethers.utils.parseEther("1"), 0, 0, accounts.deployer.address, new Date().getTime() + 60, {
            value: ethers.utils.parseEther("1")
        })
        const pairAddress = await factory.getPair(token.address, wethAddress);

        tx = await deployments.deploy("Staking", {
            from: accounts.deployer.address,
            args: [token.address, rewardPerBlock, pairAddress]
        });

        staking = await ethers.getContract("Staking");

        await token.transfer(accounts.caller.address, ethers.utils.parseEther("100000"));
        await token.transfer(accounts.staker.address, ethers.utils.parseEther("100000"));
        await token.approve(staking.address, ethers.constants.MaxUint256);
        await token.connect(accounts.staker).approve(staking.address, ethers.constants.MaxUint256);
        await token.connect(accounts.caller).approve(staking.address, ethers.constants.MaxUint256);
    })

    describe("Initialization...", async () => {
        it("Should initialize contract with correct values: ", async () => {
            expect(await staking.stakedToken()).to.equal(token.address);
            expect(await staking.rewardPerBlock()).to.equal(rewardPerBlock);
        })
    })

    describe("distributeReward function: ", async () => {
        let snapshot;

        before(async () => {
            snapshot = await ethers.provider.send("evm_snapshot", []);
        })

        after(async () => {
            await ethers.provider.send("evm_revert", [snapshot]);
        })

        it("Should update state when get first investment: ", async () => {
            const tx = await staking.connect(accounts.staker).stake(ethers.utils.parseEther("50000"));

            expect(await staking.lastRewardBlock()).to.equal(tx.blockNumber);
            expect(await staking.accRewardPerShare()).to.equal(0);
        })

        it("Should distribute rewards correctly: ", async () => {
            let tx = await staking.connect(accounts.caller).stake(ethers.utils.parseEther("50000"));
            const blockPassed = 10;
            const accRewardPerShare = await staking.accRewardPerShare();

            let currentBlock = await ethers.provider.getBlockNumber();

            for (let i = currentBlock; i < currentBlock + blockPassed; i++) {
                await ethers.provider.send("evm_mine", [])
            }

            tx = await staking.distributeReward();
            const totalStaked = await staking.totalStaked();
            const accReward = await staking.getReward(currentBlock, tx.blockNumber);
            expect(await staking.lastRewardBlock()).to.equal(tx.blockNumber);
            expect(await staking.accRewardPerShare())
                .to.equal(accRewardPerShare.add(accReward.mul(10 ** 12).div(totalStaked)));
        })
    })

    describe("Stake function: ", async () => {
        const stakeAmount = ethers.utils.parseEther("60000");
        let snapshot;

        before(async () => {
            snapshot = await ethers.provider.send("evm_snapshot", []);
        })

        after(async () => {
            await ethers.provider.send("evm_revert", [snapshot]);
        })

        it("Should stake first user: ", async () => {
            const totalStaked = await staking.totalStaked();
            const caller = await staking.userInfo(accounts.caller.address);
            const accRewardPerShare = await staking.accRewardPerShare();

            await expect(() => staking.connect(accounts.caller).stake(stakeAmount))
                .to.changeTokenBalances(
                    token,
                    [accounts.caller, staking],
                    [stakeAmount.mul(ethers.constants.NegativeOne), stakeAmount]
                );


            expect(await staking.totalStaked()).to.equal(totalStaked.add(stakeAmount));
            expect((await staking.userInfo(accounts.caller.address)).amount)
                .to.equal(caller.amount.add(stakeAmount));
            expect((await staking.userInfo(accounts.caller.address)).rewardDebt)
                .to.equal(caller.amount.mul(accRewardPerShare).div(10 ** 12));
        })

        it("Should emit event Stake with correct args", async () => {
            await expect(staking.connect(accounts.staker).stake(stakeAmount))
                .to.emit(staking, 'Stake')
                .withArgs(accounts.staker.address, stakeAmount);
        })
    })
    describe("Unstake function", async () => {
        let snapshot
        before(async () => {

            snapshot = await ethers.provider.send("evm_snapshot", [])
            console.log("\n" + "===========================" + "\n" + 'snapshotStart', snapshot + "\n" + "============================" + "\n")
        })
        after(async () => {
            await ethers.provider.send("evm_revert", [snapshot])
        })
        it("Should reverted with, Staking::bad action", async () => {
            const stakeAmount = ethers.utils.parseEther("50000")
            await staking.connect(accounts.caller).stake(stakeAmount)



            const stakeAmountBig = ethers.utils.parseEther("600000")
            await expect(staking.connect(accounts.caller).unStake(stakeAmountBig))
                .to
                .be
                .revertedWith("Staking::bad action")

        })
        it("Should normally change balance after unstake", async () => {
            const unstakeAmount = ethers.utils.parseEther("50000")
            await expect(() => staking.connect(accounts.caller).unStake(unstakeAmount))
                .to.changeTokenBalances(
                    token,
                    [staking, accounts.caller],
                    [unstakeAmount.mul(ethers.constants.NegativeOne), unstakeAmount],
                )
        })
        it("Should emit event unstake with correct args", async () => {
            const stakeAmount = ethers.utils.parseEther("50000")
            await staking.connect(accounts.staker).stake(stakeAmount)
            const unstakeAmount = ethers.utils.parseEther("50000")

            await expect(staking.connect(accounts.staker).unStake(unstakeAmount))
                .to.emit(staking, 'UnStaked')
                .withArgs(accounts.staker.address, unstakeAmount);
        })
    })
    describe("setRewardPerBlock function: ", async () => {
        let snapshot
        before(async () => {

            snapshot = await ethers.provider.send("evm_snapshot", [])
            console.log("\n" + "===========================" + "\n" + 'snapshotStart', snapshot + "\n" + "============================" + "\n")
        })
        after(async () => {
            await ethers.provider.send("evm_revert", [snapshot])
        })
        it("Should change rewardPerBlock", async () => {
            await staking.connect(accounts.deployer).setRewardPerBlock(ethers.utils.parseEther("0.5"))
            expect(await staking.rewardPerBlock()).to.equal(ethers.utils.parseEther("0.5"))
        })
    })
    describe("pendingReward function: ", async () => {
        let snapshot
        before(async () => {

            snapshot = await ethers.provider.send("evm_snapshot", [])
            console.log("\n" + "===========================" + "\n" + 'snapshotStart', snapshot + "\n" + "============================" + "\n")
        })
        after(async () => {
            await ethers.provider.send("evm_revert", [snapshot])
        })
        it("Should return pending", async () => {
            await staking.connect(accounts.staker).stake(ethers.utils.parseEther("15"))


            for (let i = 0; i < 15; i++) {
                await ethers.provider.send("evm_mine", [])
            }
            await staking.connect(accounts.caller).stake(ethers.utils.parseEther("5"))

            const totalStaked = await staking.totalStaked();
            const staker = await staking.userInfo(accounts.staker.address);
            const accRewardPerShare = await staking.accRewardPerShare();
            const getReward = await staking.getReward(
                await staking.lastRewardBlock(), await ethers.provider.getBlockNumber()
            )

            expect(await staking.connect(accounts.staker).pendingReward()).to.equal
                (
                    (
                        (staker.amount)
                            .mul(
                                (
                                    (accRewardPerShare)
                                        .add(
                                            getReward
                                                .mul(
                                                    10 ** 12
                                                )
                                                .div(
                                                    totalStaked
                                                )
                                        )
                                )
                            )
                    )
                        .div(
                            (
                                (10 ** 12 - staker.rewardDebt)
                            )
                        )
                )
        })
    })
    describe("Claim function: ", async () => {
        let snapshot
        before(async () => {

            snapshot = await ethers.provider.send("evm_snapshot", [])
            console.log("\n" + "===========================" + "\n" + 'snapshotStart', snapshot + "\n" + "============================" + "\n")
        })
        after(async () => {
            await ethers.provider.send("evm_revert", [snapshot])
        })
        it("Should claim , when one person stake and passed 10 blocks", async () => {
            let snapshotA;
            snapshotA = await ethers.provider.send("evm_snapshot", [])
            const stakeAmount = ethers.utils.parseEther("50000")
            await staking.connect(accounts.staker).stake(stakeAmount)
            advanceBlockTo(15);
            const staker = await staking.userInfo(accounts.staker.address);
            const accRewardPerShare = await staking.accRewardPerShare();
            const pending = ((staker.amount).mul(accRewardPerShare).div(10 ** 12)).sub(staker.rewardDebt)
            //   uint256 pending = (user.amount * accRewardPerShare) / 1e12 - user.rewardDebt;
            await expect(() => staking.connect(accounts.staker).claim())
                .to.changeTokenBalances(
                    token,
                    [staking, accounts.staker],
                    [pending.mul(ethers.constants.NegativeOne), pending],
                )
            await ethers.provider.send("evm_revert", [snapshotA])
        })
        // it("Should claim , when two person stake and passed 10 blocks", async () => {
        //     const stakeAmount = ethers.utils.parseEther("50000")
        //     await staking.connect(accounts.staker).stake(stakeAmount)

        //     advanceBlockTo(15);
        //     //   uint256 pending = (user.amount * accRewardPerShare) / 1e12 - user.rewardDebt;
        //     const callAmount = ethers.utils.parseEther("30000")
        //     await staking.connect(accounts.caller).stake(callAmount)

        //     advanceBlockTo(15);

        //     const staker = await staking.userInfo(accounts.staker.address);
        //     accRewardPerShare = await staking.accRewardPerShare();
        //     pending = ((staker.amount).mul(accRewardPerShare).div(10 ** 12)).sub(staker.rewardDebt)
        //     console.log("🚀 ~ file: Staking.test.js ~ line 295 ~ it ~ pending", pending.toString())

        //     await expect(() => staking.connect(accounts.staker).claim())
        //         .to.changeTokenBalances(
        //             token,
        //             [staking, accounts.staker],
        //             [pending.mul(ethers.constants.NegativeOne), pending],
        //         )

        // const caller = await staking.userInfo(accounts.caller.address);
        // accRewardPerShare = await staking.accRewardPerShare();
        // pending = ((staker.amount).mul(accRewardPerShare).div(10 ** 12)).sub(caller.rewardDebt)
        // await expect(() => staking.connect(accounts.caller).claim())
        //     .to.changeTokenBalances(
        //         token,
        //         [staking, accounts.caller],
        //         [pending.mul(ethers.constants.NegativeOne), pending],
        //     )
   // })


    it("Should emit Claim with correct args", async () => {
        const staker = await staking.userInfo(accounts.staker.address);
        const accRewardPerShare = await staking.accRewardPerShare();
        const pending = ((staker.amount).mul(accRewardPerShare).div(10 ** 12)).sub(staker.rewardDebt)
        await expect(staking.connect(accounts.staker).claim())
            .to.emit(staking, 'Claim')
            .withArgs(accounts.staker.address, pending);

    })
})
})
