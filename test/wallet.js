const { assert } = require("console");
const {expectRevert} = require('@openzeppelin/test-helpers');

const Wallet = artifacts.require('Wallet');

contract('Wallet', (accounts) => {
    let wallet;
    beforeEach(async() => {
        wallet = await Wallet.new([accounts[0],accounts[1],accounts[2]], 2);
        await web3.eth.sendTransaction({from: accounts[0], to: wallet.address, value: 10000});//wei;
    });

    it('Correct approvers and quorum', async() => {
        const approvers = await wallet.getApprovers();
        const quorum = await wallet.quorum();

        assert(approvers.length === 3);
        assert(approvers[0] == accounts[0]);
        assert(approvers[1] == accounts[1]);
        assert(approvers[2] == accounts[2]);
        assert(quorum.toNumber() === 2);

    }); 

    it('Could create transfer', async() => {
        await wallet.createTransfer(100, accounts[5], {from:accounts[1]});
        const transfer = await wallet.getTransfers();        

        assert(transfer.length === 1);
        assert(transfer[0].id === '0');
        assert(transfer[0].amount === '100');
        assert(transfer[0].to === accounts[5]);
        assert(transfer[0].approvals === '0');
        assert(transfer[0].sent === false);

    }); 

    it('NOT create transfer if sender is not approve', async () =>
    {
        await expectRevert( 
            wallet.createTransfer(100, accounts[5], {from:accounts[4]}),
            "Only approver allowed!"
            
        );              
    });

    it('increase approvals if master accepted but NOT transfer!', async() => {
        await wallet.createTransfer(100, accounts[5], {from:accounts[1]});
        await wallet.approveTransfer(0, {from:accounts[0]});
        const transfer = await wallet.getTransfers();
        const balance = await web3.eth.getBalance(wallet.address);
        assert(transfer[0].approvals === '1');
        assert(transfer[0].sent === false);
        assert(balance === '10000');
    });

    it('send the transfer if quorum reached', async() => {
       const balanceBeforeSend = web3.utils.toBN(await web3.eth.getBalance(accounts[6]));
       await wallet.createTransfer(100, accounts[6], {from:accounts[0]});
       await wallet.approveTransfer(0, {from:accounts[0]});
       await wallet.approveTransfer(0, {from:accounts[1]});
       const balanceAfterSend = web3.utils.toBN(await web3.eth.getBalance(accounts[6]));
       assert(balanceAfterSend.sub(balanceBeforeSend).toNumber() === 100);
       const transfer = await wallet.getTransfers();
       assert(transfer[0].approvals === '2');
    });

    it.only('should not approve transfer if sender is not approved', async() => {
        await wallet.createTransfer(100, accounts[5], {from:accounts[1]});
        await expectRevert(
            wallet.approveTransfer(0, {from:accounts[7]}),
            "Only approver allowed!"
        );                
    });  

    it('Should NOT approve because transfer have already been sent', async() => {
        await wallet.createTransfer(100, accounts[5], {from:accounts[0]});
        await wallet.approveTransfer(0, {from:accounts[0]});
        await wallet.approveTransfer(0, {from:accounts[1]});

        await expectRevert(
              wallet.approveTransfer(0,{from:accounts[2]}),
              "Transfer has already been sent!"
        );
    });

    it('Should NOT approve a transfer twice', async() => {
        await wallet.createTransfer(100, accounts[5], {from:accounts[0]});
        await wallet.approveTransfer(0, {from:accounts[0]});
        await expectRevert(
            wallet.approveTransfer(0, {from:accounts[0]}),
            "Cannot approve transfer twice!"
        );
        
    });

})  