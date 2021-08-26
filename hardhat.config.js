require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require('hardhat-deploy');
require("hardhat-deploy-ethers");
require("hardhat-etherscan-abi");
require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-web3");

const {
  normalizeHardhatNetworkAccountsConfig
} = require("hardhat/internal/core/providers/util")

const {
  BN,
  bufferToHex,
  privateToAddress,
  toBuffer
} = require("ethereumjs-util")

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const networkConfig = hre.config.networks["hardhat"]


  const accounts = normalizeHardhatNetworkAccountsConfig(networkConfig.accounts)

  console.log("Accounts")
  console.log("========")

  for (const [index, account] of accounts.entries()) {
    const address = bufferToHex(privateToAddress(toBuffer(account.privateKey)))
    const privateKey = bufferToHex(toBuffer(account.privateKey))
    const balance = new BN(account.balance).div(new BN(10).pow(new BN(18))).toString(10)
    console.log(`Account #${index}: ${address} (${balance} ETH)
Private Key: ${privateKey}
`)
  }
});

const ALCHEMY_API_KEY = "hOzQc-RVIceGHwDh_iu1bIwlaXemJvzy";
const ETHERSCAN_API_KEY = "49USA2B7IQCNV3BT61PTVXXQ2UB15GNPAW";
const PRIVATE_KEY = "43e2458f1c385b0a7c1186c0693a16c63ea148bd8b97982373cd5138fa605a73";

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  networks: {
    hardhat: {
      forking: {
        enabled: true,
        url: `https://eth-mainnet.alchemyapi.io/v2/hOzQc-RVIceGHwDh_iu1bIwlaXemJvzy`,
        blockNumber: 13093511
      },
    },
    rinkeby: {
      url: `https://eth-rinkeby.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
      accounts: [`0x${PRIVATE_KEY}`],
    },
    ropsten: {
      url: `https://eth-ropsten.alchemyapi.io/v2/${ALCHEMY_API_KEY}`,
      accounts: [`0x${PRIVATE_KEY}`],
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
      "3": "0x5f2cFa351B7d4b973d341fdB2cB154794c0a899c",
      "4": "0x5f2cFa351B7d4b973d341fdB2cB154794c0a899c",
    },
    caller: {
      default: 1
    },
    staker: {
      default: 2
    }
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  },
  solidity: "0.8.6",
};