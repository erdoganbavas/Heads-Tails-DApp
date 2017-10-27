pragma solidity ^0.4.11;

contract BetBook{
  enum Side {NONE, HEAD, TAIL}

  struct Bet {
    uint id;
    address seller;
    address buyer;
    Side sellerCh;
    uint256 amount;
    Side result;
  }

  mapping(uint => Bet) public bets;
  mapping(address => uint256) public pendingWithdraws;
  uint betCounter;

  event startBetEvent (
    uint indexed _id
  );

  event joinBetEvent (
    uint indexed _id,
    address _winner
  );

  //
  function startBet(uint _choice) payable public {
    // for new bet
    betCounter++;

    Side _sellerCh = Side.NONE;
    if(_choice == 1){
      _sellerCh = Side.HEAD;
    }else{
      _sellerCh = Side.TAIL;
    }

    // store this bet
    bets[betCounter] = Bet(
         betCounter,
         msg.sender,
         0x0,
         _sellerCh,
         msg.value,
         Side.NONE
    );

    // trigger the event
    startBetEvent(betCounter);
  }

  function getClosedBets() public constant returns(uint[]) {
    if(betCounter == 0) {
      return new uint[](0);
    }

    // create a long array to hold
    uint[] memory betIds = new uint[](betCounter);

    uint numberOfClosedBets = 0;
    for (uint i = 1; i <= betCounter; i++) {
      if (bets[i].buyer != 0x0) {
        betIds[numberOfClosedBets] = bets[i].id;
        numberOfClosedBets++;
      }
    }

    // copy it to a shorter array
    uint[] memory closedBets = new uint[](numberOfClosedBets);
    for (uint j = 0; j < numberOfClosedBets; j++) {
      closedBets[j] = betIds[j];
    }
    return (closedBets);
  }

  function getOpenBets() public constant returns(uint[]) {
    if(betCounter == 0) {
      return new uint[](0);
    }

    // create a long array to hold
    uint[] memory betIds = new uint[](betCounter);

    uint numberOfOpenBets = 0;
    for (uint i = 1; i <= betCounter; i++) {
      if (bets[i].buyer == 0x0) {
        betIds[numberOfOpenBets] = bets[i].id;
        numberOfOpenBets++;
      }
    }

    // copy it to a shorter array
    uint[] memory openBets = new uint[](numberOfOpenBets);
    for (uint j = 0; j < numberOfOpenBets; j++) {
      openBets[j] = betIds[j];
    }
    return (openBets);
  }

  function joinBet(uint _id) payable public {
    require(_id > 0 && _id <= betCounter);

    Bet storage bet = bets[_id];
    uint256 _amount = msg.value;

    require(bet.buyer == 0x0);
    require(bet.seller != msg.sender);
    require(bet.amount == _amount);
    require(bet.result == Side.NONE);

    bet.buyer = msg.sender;

    // select a rand side decide winner
    if(block.number % 2 == 0){
      // head wins
      bet.result = Side.HEAD;
    } else if(block.number % 2 == 1){
      // buyer wins
      bet.result = Side.TAIL;
    }

    address _winner = 0x0;
    if (bet.result == bet.sellerCh) {
      pendingWithdraws[bet.seller] += bet.amount + _amount;
      _winner = bet.seller;
    }else{
      pendingWithdraws[bet.buyer] += bet.amount + _amount;
      _winner = bet.buyer;
    }

    joinBetEvent(_id, _winner);
  }

  function withdraw() {
    uint256 _amount = pendingWithdraws[msg.sender];

    require(_amount > 0);

    pendingWithdraws[msg.sender] = 0;
    msg.sender.transfer(_amount);
  }
}
