var BetBook = artifacts.require("./BetBook.sol");

module.exports = function(deployer) {
  deployer.deploy(BetBook);
}
