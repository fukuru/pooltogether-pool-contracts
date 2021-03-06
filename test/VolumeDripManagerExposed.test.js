const { deployContract, deployMockContract } = require('ethereum-waffle')
const VolumeDripManagerExposed = require('../build/VolumeDripManagerExposed.json')
const ERC20Mintable = require('../build/ERC20Mintable.json')
const IERC20 = require('../build/IERC20.json')

const { ethers } = require('ethers')
const { expect } = require('chai')
const buidler = require('@nomiclabs/buidler')
const { AddressZero } = require('ethers').constants

const toWei = ethers.utils.parseEther

const debug = require('debug')('ptv3:VolumeDripManagerExposed.test')
const SENTINAL = '0x0000000000000000000000000000000000000001'

let overrides = { gasLimit: 20000000 }

describe('VolumeDripManagerExposed', function() {

  let manager

  let measure, drip1, drip2, drip3

  let invalidDrip = '0x0000000000000000000000000000000000000003'

  let periodSeconds = 10
  let dripAmount = toWei('10')

  beforeEach(async () => {
    [wallet, wallet2, wallet3, wallet4] = await buidler.ethers.getSigners()

    manager = await deployContract(wallet, VolumeDripManagerExposed, [], overrides)

    debug({ manager: manager.address })

    measure = await deployContract(wallet, ERC20Mintable, ['Measure Token', 'MTKN'], overrides)
    drip1 = await deployContract(wallet, ERC20Mintable, ['Drip Token 1', 'DRIP1'], overrides)
    drip2 = await deployContract(wallet, ERC20Mintable, ['Drip Token 2', 'DRIP2'], overrides)
    drip3 = await deployMockContract(wallet, IERC20.abi)
  })

  describe('activate()', () => {
    it('should activate a drip token', async () => {
      await manager.activate(measure.address, drip1.address, periodSeconds, dripAmount, 30)
      expect(await manager.isActive(measure.address, drip1.address)).to.be.true
      expect(await manager.getDrip(measure.address, drip1.address)).to.deep.equal([
        periodSeconds,
        dripAmount
      ])
      expect(await manager.getPeriod(measure.address, drip1.address, 1)).to.deep.equal([
        toWei('0'),
        dripAmount,
        30
      ])
    })

    it('should support multiple drips', async () => {
      await manager.activate(measure.address, drip1.address, periodSeconds, dripAmount, 30)
      await manager.activate(measure.address, drip2.address, periodSeconds, dripAmount, 30)
      expect(await manager.isActive(measure.address, drip1.address)).to.be.true
      expect(await manager.isActive(measure.address, drip2.address)).to.be.true
    })

    it('should not allow a drip to be re-activated', async () => {
      await manager.activate(measure.address, drip1.address, periodSeconds, dripAmount, 30)
      await expect(manager.activate(measure.address, drip1.address, periodSeconds, dripAmount, 30)).to.be.revertedWith("VolumeDripManager/drip-active")
    })
  })

  describe('deactivate()', () => {
    it('should allow drips to be deactivated', async () => {
      await manager.activate(measure.address, drip1.address, periodSeconds, dripAmount, 30)
      await manager.deactivate(measure.address, drip1.address, SENTINAL)
      expect(await manager.isActive(measure.address, drip1.address)).to.be.false
    })
  })
 
  describe('getActiveVolumeDrips()', () => {
    it('should return a list of active volume drip tokens', async () => {
      await manager.activate(measure.address, drip1.address, periodSeconds, dripAmount, 30)

      expect(await manager.getActiveVolumeDrips(measure.address))
        .to.deep.equal([drip1.address])
    })
  })

  describe('set()', () => {
    it('should allow active drips to be set', async () => {
      await manager.activate(measure.address, drip1.address, periodSeconds, dripAmount, 30)
      await manager.set(measure.address, drip1.address, 2, toWei('3'))
      expect(await manager.getDrip(measure.address, drip1.address)).to.deep.equal([
        2,
        toWei('3')
      ])
    })

    it('should revert for inactive drips', async () => {
      await expect(manager.set(measure.address, drip1.address, periodSeconds, dripAmount)).to.be.revertedWith("VolumeDripManager/drip-not-active")
    })
  })

});
