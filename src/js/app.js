App = {
  web3Provider: null,
  contracts: {},
  account: 0x0,
  loading: false,
  Sides: {'NONE':0, 'HEAD': 1, 'TAIL': 2},

  init: function() {
    // Initialize app
    return App.initWeb3();
  },
  initWeb3: function() {
    // Initialize web3 and set the provider to the testRPC.
    if (typeof web3 !== 'undefined') {
      App.web3Provider = web3.currentProvider;
      web3 = new Web3(web3.currentProvider);
    } else {
      // set the provider you want from Web3.providers
      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:8545');
      web3 = new Web3(App.web3Provider);
    }

    // right after web3 initalization get account details
    App.getAccountDetails();

    return App.initContract();
  },
  initContract: function() {
    $.getJSON('BetBook.json', function(betBookArtifact) {
      // Get the necessary contract artifact file and use it to instantiate a truffle contract abstraction.
      App.contracts.BetBook = TruffleContract(betBookArtifact);

      // Set the provider for our contract.
      App.contracts.BetBook.setProvider(App.web3Provider);

      // Listen for events that we specify in our contract
      App.listenToEvents();

      // Retrieve open bets from the smart contract
      return App.reloadBets();
    });
  },
  getAccountDetails: function() {
    // wrapper element of account details
    var $accountDetailsWrapper = $("#accountDetails");

    web3.eth.getCoinbase((err, account) => {
      if (err !== null) {
        console.log(err);
        return;
      }
      App.account = account;

      // get address of current account
      $accountDetailsWrapper
        .find("span.address")
        .text(account);

      // get balance of current account
      web3.eth.getBalance(account, (err, balance) => {
        if (err === null) {
          $accountDetailsWrapper
            .find("strong.balance")
            .text(web3.fromWei(balance, "ether") + " ETH");
        }
      });

      // get pending withdrawal amount
      App.contracts.BetBook.deployed()
        .then((instance) => {
          instance.pendingWithdraws(account).then((withdrawAmount) => {
            var $withdrawalDetailsWrapper = $("#withdrawalDetails");

             $withdrawalDetailsWrapper
              .find("strong")
              .text(web3.fromWei(withdrawAmount, "ether") + " ETH");

             if(withdrawAmount > 0){
               $withdrawalDetailsWrapper.find("button").show();
             }else{
               $withdrawalDetailsWrapper.find("button").hide();
             }
          });
        }).catch(function(err) {
          console.log(err);
        });
    });
  },
  reloadBets: function(){
    // check if some async operations already running
    if (App.loading) {
      return;
    }
    App.loading = true;

    // refresh account
    App.getAccountDetails();

    // a scope wide var to use in promises
    var contractInstance;

    // get deployed contract instance
    App.contracts.BetBook.deployed().then((instance) => {
      contractInstance = instance;
      return contractInstance.getOpenBets();
    }).then((betIds) => {
      // Clear the bet list wrapper
      $('#openBets').empty();

      // iterate over open bets and display in DOM
      for (var i = 0; i < betIds.length; i++) {
        var betId = parseInt(betIds[i]);
        contractInstance.bets(betId).then((bet) => {
          App.displayBet(bet);
        });
      }
      App.loading = false;
    }).catch((err) => {
      console.log(err);
      App.loading = false;
    });
  },
  displayBet: function(bet){
    // bet parameter has structure of Bet struct we defined in Contract with index based array
    var betId = bet[0];
    var seller = bet[1];
    var buyer = bet[2];
    var sellerCh = parseInt(bet[3]);
    var amount = bet[4];

    // turn sellers side choice to human readable string
    var sellerChStr = App.Sides.HEAD===sellerCh?'Head':'Tail';

    // Retrieve the bet list wrapper
    var $openBetsWrapper = $('#openBets');

    // bets amount in ether unit
    var etherPrice = web3.fromWei(amount, "ether");

    // Retrieve and fill the bet template
    var $betTemplate = $('#betTemplate');
    $betTemplate.find('.panel-title > strong').text(sellerChStr);
    $betTemplate.find('.bet-amount').text(etherPrice + " ETH");
    $betTemplate.find('.btn-join').attr('data-id', betId);
    $betTemplate.find('.btn-join').attr('data-amount', etherPrice);

    // hide join button from the seller
    if (seller == App.account) {
      $betTemplate.find('.bet-seller').text("You");
      $betTemplate.find('.btn-join').hide();
    } else {
      $betTemplate.find('.bet-seller').text(seller);
      $betTemplate.find('.btn-join').show();
    }

    // copy and append template to the list
    $openBetsWrapper.append($betTemplate.html());
  },
  joinBet: function(button) {
    var $button = $(button);
    var betId = parseInt($button.data('id'));
    var amount = parseFloat($button.data('amount'));

    // get the deployed contract instance
    App.contracts.BetBook.deployed()
      .then((instance) => {
        return instance.joinBet(betId, {
          from: App.account,
          value: web3.toWei(amount, "ether"),
          gas: 500000
        });
      }).then((result) => {
        console.log("Join Bet Successful")
        console.log(result);
      }).catch((err) => {
        console.error(err);
      });

    // return false to prevent default behaviour
    return false;
  },
  withdrawal: function(){
    App.contracts.BetBook.deployed()
      .then((instance) => {
        return instance.withdraw({
          from: App.account,
          gas: 500000
        });
      }).then(function(result) {
        console.log("Withdrawal Successful");
        console.log(result);

        // refresh account details
        App.getAccountDetails();
      }).catch(function(err) {
        console.error(err);
      });
  },
  startBet: function(form) {
    var $form = $(form);

    var sellerCh = $form.find("[name='sellerCh']:checked").val();
    var amount = parseFloat($form.find("#amountInput").val());

    // turn seller's choice from string to integer
    sellerCh = sellerCh=='head'?App.Sides.HEAD:App.Sides.TAIL;

    // check if bet amount is valid
    if(amount <= 0 || isNaN(amount)) {
      alert("Amount can't be less then zero.")
      return false;
    }

    App.contracts.BetBook.deployed()
      .then((instance) => {
        return instance.startBet(sellerCh, {
          from: App.account,
          value: web3.toWei(amount, "ether"),
          gas: 500000
        })
      })
      .then((result) => {
        console.log("Bet started");
        console.log(result);

        // reload bets and refresh profilo info
        App.reloadBets();
        App.getAccountDetails();
      })
      return false;
  },
  listenToEvents: function() {
    // Listen event that we defined in the Contract
    App.contracts.BetBook.deployed().then(function(instance) {
      // toBlock value should be 'latest' to cover all events on blockchain
      // but a bug on MetaMask may slow down firing event on wide ranges
      // for now we will try between 0-1000 blocks
      // And if still can't catch events just switch your network to Main network
      // and back to the local network
      instance.startBetEvent({}, {
        fromBlock: 0,
        toBlock: 1000
      }).watch(function(error, event) {
        if (!error) {
          console.log("Bet Start Event catched");
          App.getAccountDetails();
          App.reloadBets();
          console.log(event);
        }else{
          console.log(error);
        }
      });

      instance.joinBetEvent({}, {
        fromBlock: 0,
        toBlock: 1000
      }).watch((error, event) => {
        if (!error) {
          console.log("Join Bet event fired")

          // alert winner
          if (event.args._winner == App.account) {
            alert("Congrats, You Win!");
          } else {
            alert("Too bad, You lost.");
          }
          App.getAccountDetails();
          App.reloadBets();
          console.log(event);
        }else{
          console.log(error);
        }
      });
    });
  },
};

$(function() {
  $(window).load(function() {
    // we start our App after window loaded
    App.init();
  });
});
