const PrizeStrategyHarness = require('../build/PrizeStrategyHarness.json')
const RNGServiceMock = require('../build/RNGServiceMock.json')
const Forwarder = require('../build/Forwarder.json')
const ComptrollerHarness = require('../build/ComptrollerHarness.json')
const ControlledToken = require('../build/ControlledToken.json')
const CompoundPrizePoolHarness = require('../build/CompoundPrizePoolHarness.json')
const CTokenMock = require('../build/CTokenMock.json')
const ERC20Mintable = require('../build/ERC20Mintable.json')

const ethers = require('ethers')
const { deploy1820 } = require('deploy-eip-1820')
const { deployContract } = require('ethereum-waffle')
const toWei = (val) => ethers.utils.parseEther('' + val)

const debug = require('debug')('ptv3:deployTestPool')

async function deployTestPool({
  wallet,
  prizePeriodSeconds,
  maxExitFeeMantissa,
  maxTimelockDuration,
  exitFee,
  creditRate,
  externalERC20Awards,
  overrides = { gasLimit: 20000000 }
}) {
  let registry = await deploy1820(wallet)

  debug('beforeEach deploy rng, forwarder etc...')

  let rng = await deployContract(wallet, RNGServiceMock, [], overrides)
  let forwarder = await deployContract(wallet, Forwarder, [], overrides)
  let token = await deployContract(wallet, ERC20Mintable, [], overrides)
  let cToken = await deployContract(wallet, CTokenMock, [
    token.address, ethers.utils.parseEther('0.01')
  ], overrides)

  debug('Deploying Governor...')

  let governanceToken = await deployContract(wallet, ERC20Mintable, [], overrides)

  let comptroller = await deployContract(wallet, ComptrollerHarness, [], overrides)
  await comptroller.initialize()

  debug('Deploying PrizeStrategy...')

  let prizeStrategy = await deployContract(wallet, PrizeStrategyHarness, [], overrides)

  debug('Deploying CompoundPrizePoolHarness...')

  let compoundPrizePool = await deployContract(wallet, CompoundPrizePoolHarness, [], overrides)

  debug('Deploying Sponsorship...')

  let sponsorship = await deployContract(wallet, ControlledToken, [], overrides)
  await sponsorship.initialize("Sponsorship", "SPON", forwarder.address, compoundPrizePool.address)

  debug('Deploying Ticket...')

  let ticket = await deployContract(wallet, ControlledToken, [], overrides)
  await ticket.initialize("Ticket", "TICK", forwarder.address, compoundPrizePool.address)

  debug('Initializing CompoundPrizePoolHarness...')

  await compoundPrizePool.initializeAll(
    forwarder.address,
    prizeStrategy.address,
    [ticket.address, sponsorship.address],
    maxExitFeeMantissa || toWei('0.5'),
    maxTimelockDuration || '10000',
    cToken.address
  )

  debug('Initializing PrizeStrategy...')

  await prizeStrategy.initialize(
    forwarder.address,
    comptroller.address,
    prizePeriodSeconds,
    compoundPrizePool.address,
    ticket.address,
    sponsorship.address,
    rng.address,
    externalERC20Awards
  )

  await prizeStrategy.setExitFeeMantissa(exitFee || toWei('0.1'))
  await prizeStrategy.setCreditRateMantissa(creditRate || toWei('0.1').div(prizePeriodSeconds))

  debug("Addresses: \n", {
    rng: rng.address,
    registry: registry.address,
    forwarder: forwarder.address,
    token: token.address,
    cToken: cToken.address,
    comptroller: comptroller.address,
    prizeStrategy: prizeStrategy.address,
    ticket: ticket.address,
    compoundPrizePool: compoundPrizePool.address,
    sponsorship: sponsorship.address,
    prizeStrategy: prizeStrategy.address,
    governanceToken: governanceToken.address
  })

  return {
    rng,
    registry,
    forwarder,
    token,
    cToken,
    comptroller,
    prizeStrategy,
    compoundPrizePool,
    ticket,
    sponsorship,
    governanceToken
  }
}

module.exports = {
  deployTestPool
}