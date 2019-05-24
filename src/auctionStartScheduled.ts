import { auctionId, zeroAsBigInt, tokenPairId } from './utils';
import { AuctionStartScheduled } from './types/DutchExchange/DutchExchange';
import { Auction, TokenPair, Trader } from './types/schema';

export function handleAuctionStartScheduled(event: AuctionStartScheduled): void {
  let params = event.params;
  let from = event.transaction.from;
  let trader = Trader.load(from.toHex());

  // TokenPair SECTION
  let tokenPair = TokenPair.load(tokenPairId(params.sellToken, params.buyToken));
  if (tokenPair == null) {
    tokenPair.token1 = params.sellToken;
    tokenPair.token2 = params.buyToken;
    tokenPair = new TokenPair(tokenPairId(params.sellToken, params.buyToken));
    tokenPair.currentAuctionIndex = 0;
    tokenPair.auctions = [];
    tokenPair.traders = [trader.id];
    tokenPair.listingTimestamp = event.block.timestamp;
    tokenPair.listingTransactionHash = event.transaction.hash;
  }
  tokenPair.latestStartTime = params.auctionStart;
  let tokenPairTraders = tokenPair.traders;
  tokenPairTraders[tokenPairTraders.length] = trader.id;
  tokenPair.traders = tokenPairTraders;
  tokenPair.save();

  // Auction SECTION
  let sellAuctionId = auctionId(params.sellToken, params.buyToken, params.auctionIndex);
  let sellAuction = Auction.load(sellAuctionId);
  if (sellAuction == null) {
    sellAuction = new Auction(sellAuctionId);
    sellAuction.totalFeesPaid = zeroAsBigInt;
    sellAuction.traders = [];
    sellAuction.sellOrders = [];
    sellAuction.buyOrders = [];
  }
  sellAuction.sellToken = params.sellToken;
  sellAuction.buyToken = params.buyToken;
  sellAuction.auctionIndex = params.auctionIndex;
  sellAuction.sellVolume = zeroAsBigInt;
  sellAuction.buyVolume = zeroAsBigInt;
  sellAuction.cleared = false;
  sellAuction.startTime = params.auctionStart;
  sellAuction.clearingTime = zeroAsBigInt;
  sellAuction.tokenPair = tokenPair.id;
  sellAuction.traders = [];
  sellAuction.save();

  let buyAuctionId = auctionId(params.buyToken, params.sellToken, params.auctionIndex);
  let buyAuction = Auction.load(buyAuctionId);
  if (buyAuction == null) {
    buyAuction = new Auction(buyAuctionId);
    buyAuction.totalFeesPaid = zeroAsBigInt;
    buyAuction.traders = [];
    buyAuction.sellOrders = [];
    buyAuction.buyOrders = [];
  }
  buyAuction.sellToken = params.buyToken;
  buyAuction.buyToken = params.sellToken;
  buyAuction.auctionIndex = params.auctionIndex;
  buyAuction.sellVolume = zeroAsBigInt;
  buyAuction.buyVolume = zeroAsBigInt;
  buyAuction.cleared = false;
  buyAuction.startTime = params.auctionStart;
  buyAuction.clearingTime = zeroAsBigInt;

  buyAuction.tokenPair = tokenPair.id;
  buyAuction.traders = [];
  buyAuction.save();
}
