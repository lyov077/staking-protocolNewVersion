module.exports = async function ({
    getNamedAccounts,
    deployments
}) {
    const {
        deploy
    } = deployments;

    const {
        deployer
    } = await getNamedAccounts()

    await deploy('ClassToken', {
        from: deployer,
        log: true,
    });
}

module.exports.tags = ["ClassToken"]