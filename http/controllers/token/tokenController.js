const utils = require('../../../etc/utils');
const response = require('../../../etc/response');
const tronUtils = require('../../../etc/tronUtils');
const resCode = require('../../../enum/responseCodesEnum');
const resMessage = require('../../../enum/responseMessagesEnum');
const rewardEnum = require('./../../../enum/rewardEnum');

const db = global.healthportDb;

async function sendToken(req, res) {
    try {
        let to = req.body.to;
        let amount = parseFloat(req.body.amount);
        let from = utils.encrypt(req.body.from);
        let note = req.body.note;
        let err, user, trxId, privateKey, obj;

        //Check ammount is positive integer or not
        if (!Number.isInteger(amount) || amount < 0)
            return response.sendResponse(res, resCode.NOT_FOUND, resMessage.AMOUNT_IS_NOT_INTEGER);

        //Finding record from db    
        [err, user] = await utils.to(db.models.users.findOne({ where: { tron_wallet_public_key: from } }));
        if (user == null) return response.sendResponse(res, resCode.NOT_FOUND, resMessage.USER_NOT_FOUND);

        let isValid = await tronUtils.isAddress(to);
        if (!isValid) return response.sendResponse(res, resCode.NOT_FOUND, resMessage.INVALID_TO_ADDRESS);

        //Getting token balance and checking bandwidth.
        privateKey = utils.decrypt(user.tron_wallet_private_key);
        let balance = await tronUtils.getTRC10TokenBalance(privateKey, utils.decrypt(from));
        if (balance == 0) return response.sendResponse(res, resCode.BAD_REQUEST, resMessage.BALANCE_IS_ZERO);
        if (balance < amount) return response.sendResponse(res, resCode.BAD_REQUEST, resMessage.INSUFFICIENT_BALANCE);

        let bandwidth = await tronUtils.getBandwidth(utils.decrypt(from));
        if (bandwidth < 275) return response.sendResponse(res, resCode.BAD_REQUEST, resMessage.BANDWIDTH_IS_LOW);

        //Sending token
        try {
            trxId = await tronUtils.sendTRC10Token(to, amount, privateKey);
        } catch (error) {
            console.log(error);
            return response.errReturned(res, error);
        }

        //Saving transection history into db
        [err, obj] = await utils.to(db.models.transections.bulkCreate([
            { user_id: user.id, address: from, number_of_token: amount, trx_hash: trxId, type: 'Sent', note: note },
            { user_id: user.id, address: utils.encrypt(to), number_of_token: amount, trx_hash: trxId, type: 'Received', note: note }
        ]));
        console.log(err);
        //Returing successful response with trxId
        return response.sendResponse(res, resCode.SUCCESS, resMessage.SUCCESS, trxId);

    } catch (error) {
        console.log(error);
        return response.errReturned(res, error);
    }
    //#region  old code
    //try {
    //     let to = req.body.to;
    //     let amount = req.body.amount;
    //     let from = utils.encrypt(req.body.from);

    //     let err, user, transection;
    //     //Finding record from db    
    //     [err, user] = await utils.to(db.models.users.findOne(
    //         {
    //             where:
    //             {
    //                 tron_wallet_public_key: from
    //             }
    //         }));
    //     if (err) return response.sendResponse(res, resCode.INTERNAL_SERVER_ERROR, resMessage.ERROR_IN_FINDING_RECORD);
    //     if (user == null) return response.sendResponse(res, resCode.NOT_FOUND, resMessage.USER_NOT_FOUND);

    //     //Initializing tronweb object and validating address.
    //     let privateKey = utils.decrypt(user.tron_wallet_private_key);

    //     let isValid = await tronUtils.isAddress(to);
    //     if (!isValid) return response.sendResponse(res, resCode.NOT_FOUND, resMessage.INVALID_TO_ADDRESS);

    //     //Getting values from smart contract
    //     let balance = await tronUtils.getBalanceToken(privateKey, utils.decrypt(from));
    //     if (balance == 0) return response.sendResponse(res, resCode.BAD_REQUEST, resMessage.BALANCE_IS_ZERO);
    //     if (balance < amount) return response.sendResponse(res, resCode.BAD_REQUEST, resMessage.INSUFFICIENT_BALANCE);

    //     //Checking Tron Balance before making transection
    //     let tronBalance = await tronUtils.getBalanceTrx(utils.decrypt(from))
    //     if (tronBalance < parseFloat(process.env.MINIMUM_TRON_BALACE_REQUIRED))
    //         return response.sendResponse(res, resCode.BAD_REQUEST, resMessage.TRON_BALANCE_IS_ZERO)

    //     //Sending token
    //     try {
    //         transection = await tronUtils.sendToken(to, amount, privateKey);
    //     } catch (error) {
    //         console.log(error);
    //         return response.sendResponse(res, resCode.INTERNAL_SERVER_ERROR, error);
    //     }

    //     //Saving transection history into db
    //     [err, obj] = await utils.to(db.models.transections.create(
    //         {
    //             user_id: user.id,
    //             from: from,
    //             to: utils.encrypt(to),
    //             number_of_token: amount,
    //             trx_hash: transection
    //         }));
    //     if (err) return response.sendResponse(res, resCode.INTERNAL_SERVER_ERROR, resMessage.ERROR_IN_SAVING_TRANSECTION);

    //     return response.sendResponse(res, resCode.SUCCESS, resMessage.SUCCESS, transection);

    // } catch (error) {
    //     console.log(error);
    //     return response.sendResponse(res, resCode.INTERNAL_SERVER_ERROR, resMessage.API_ERROR);
    // }
    //#endregion
}

async function getBalance(req, res) {
    try {
        let address = utils.encrypt(req.body.address);
        let err, user, balance;

        //Finding record from db    
        [err, user] = await utils.to(db.models.users.findOne({ where: { tron_wallet_public_key: address } }));
        if (user == null) return response.sendResponse(res, resCode.NOT_FOUND, resMessage.USER_NOT_FOUND);

        //Getting balance from blockchain
        let privateKey = utils.decrypt(user.tron_wallet_private_key);
        let publickKey = utils.decrypt(user.tron_wallet_public_key);
        balance = await tronUtils.getTRC10TokenBalance(privateKey, publickKey);

        //Returing successful response with balance
        return response.sendResponse(res, resCode.SUCCESS, resMessage.SUCCESS, balance);

    } catch (error) {
        console.log(error);
        return response.errReturned(res, error);
    }
}

async function getTransectionsByAddress(req, res) {
    try {
        let address = utils.encrypt(req.body.address);
        let pageSize = parseInt(req.body.pageSize);
        let pageNumber = parseInt(req.body.pageNumber);
        let err, user, transections;

        //Paging
        if (!pageNumber) pageNumber = 0;
        if (!pageSize) pageSize = 5;
        let start = parseInt(pageNumber * pageSize);
        let end = parseInt(start + pageSize);

        //Finding record from db    
        [err, user] = await utils.to(db.models.users.findOne({ where: { tron_wallet_public_key: address } }));
        if (user == null) return response.sendResponse(res, resCode.NOT_FOUND, resMessage.USER_NOT_FOUND);

        //Getting transection history data and total count
        [err, transections] = await utils.to(db.models.transections.findAndCountAll({
            where: [{ address: address }],
            order: [['createdAt', 'DESC']],
            limit: pageSize,
            offset: start
        }));

        let data = [];
        for (let i = 0; i < transections.rows.length; i++) {
            data[i] = {
                'trx_id': transections.rows[i].trx_hash,
                'date_time': transections.rows[i].createdAt,
                'type': transections.rows[i].type,
                'note': transections.rows[i].note
            }
        }

        //Returing successful response with transections
        return response.sendResponse(res, resCode.SUCCESS, resMessage.SUCCESS, { count: transections.count, data: data });

    } catch (error) {
        console.log(error);
        return response.errReturned(res, error);
    }
}

async function getFormSubmissionDates(req, res) {
    try {
        let user_id = req.body.userId;
        let err, allergies, medications, procedures;

        //Need to optimize this query with one call
        [err, allergies] = await utils.to(db.models.allergies.findOne(
            { where: { user_id: user_id }, order: [['createdAt', 'DESC']] }));
        [err, medications] = await utils.to(db.models.medications.findOne(
            { where: { user_id: user_id }, order: [['createdAt', 'DESC']] }));
        [err, procedures] = await utils.to(db.models.procedures.findOne(
            { where: { user_id: user_id }, order: [['createdAt', 'DESC']] }));

        let data = {
            'allergy_date': allergies ? allergies.createdAt : null,
            'medication_date': medications ? medications.createdAt : null,
            'procedure_date': procedures ? procedures.createdAt : null
        }

        //Returing successful response with transections
        return response.sendResponse(res, resCode.SUCCESS, resMessage.SUCCESS, data);

    } catch (error) {
        console.log(error);
        return response.errReturned(res, error);
    }
}

async function getReferralsByUser(req, res) {
    try {
        let user_id = req.body.userId;
        let referal_coupon = req.body.referalCoupon;
        let pageSize = parseInt(req.body.pageSize);
        let pageNumber = parseInt(req.body.pageNumber);
        let err, users;

        //Paging
        if (!pageNumber) pageNumber = 0;
        if (!pageSize) pageSize = 5;
        let start = parseInt(pageNumber * pageSize);
        let end = parseInt(start + pageSize);

        //Fetching records from db w.r.t referal code    
        [err, users] = await utils.to(db.models.users.findAndCountAll({
            where: { refer_by_coupon: referal_coupon, email_confirmed: true },
            order: [['createdAt', 'DESC']],
            limit: pageSize,
            offset: start
        }));
        [err, rewardObj] = await utils.to(db.models.reward_conf.findOne({ where: { reward_type: rewardEnum.REFERRALREWARD } }));
        let data = [];
        for (let i = 0; i < users.rows.length; i++) {
            data[i] = {
                'email': users.rows[i].email,
                'channel': users.rows[i].refer_destination,
                'referal_reward': parseInt(rewardObj.reward_amount)
            }
        }

        //Returing successful response with transections
        return response.sendResponse(res, resCode.SUCCESS, resMessage.SUCCESS, { count: users.count, data: data });

    } catch (error) {
        console.log(error);
        return response.errReturned(res, error);
    }
}

//This route is for server testing purpose only
async function getEnv(req, res) {

    //let transection = await tronUtils.createSmartContract();

    return response.sendResponse(res, resCode.SUCCESS, transection);
}

module.exports = {
    sendToken,
    getBalance,
    getReferralsByUser,
    getFormSubmissionDates,
    getTransectionsByAddress,
    getEnv
}