const {
  expect
} = require("chai");
const {
  ethers,
  deployments,
  web3
} = require("hardhat");

describe("ClassToken contract: ", function () {
  let classToken, accounts;
  before("Before: ", async () => {
      accounts = await ethers.getNamedSigners()

      tx = await deployments.deploy("ClassToken", {
          from: accounts.deployer.address,
          log: false,
      });

      classToken = await ethers.getContract("ClassToken");
  })

  describe("Initialization...", async () => {
      it("Should initialize contract with correct values: ", async () => {
          expect(await classToken.name()).to.equal("Class Token");
          expect(await classToken.symbol()).to.equal("CLS");
          expect(await classToken.totalSupply()).to.equal(ethers.utils.parseEther("300000"));
          expect(await classToken.balanceOf(accounts.deployer.address)).to.equal(ethers.utils.parseEther("300000"));
      })
  })
})