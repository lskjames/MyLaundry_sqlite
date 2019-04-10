var mqtt = require('mqtt');
var mqttClient = mqtt.connect('mqtt://localhost:1883');
exports.mqttC = mqttClient
var moment = require('moment');
var rpting = require('./reporting.js')
var math = require('math');
var varItem = require('../credentials/variables.js');
const sqlite3 = require('sqlite3').verbose();
const outlet = require('../data/outlet.js')
var reports_deposit_area = outlet.rptFolderID
var nodemailer = require('nodemailer');
var myRunRecord = {}
var pricing_data = {}

/////////////////////////////////////
///// sqlite initialization ///////
/////////////////////////////////////
let db = new sqlite3.Database('./mydb/laundry.db', sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the laundry database.');
});

//////////////////////////////////////////////////////////////
// Sending the credit to the ESP which received from Wechat///
//////////////////////////////////////////////////////////////

module.exports.onMachine = function (machine_no, money) {
	money_str = money.toString()
	mqttClient.publish(machine_no, money_str)
}

module.exports.updateTime = function () {
	var currentTime  = moment().valueOf()
	var ctString = currentTime.toString();
	console.log(ctString);
	mqttClient.publish("timeUpdate", ctString)
}

module.exports.manualKeepAlive = function () {
	mqttClient.publish("keepMeAlive", "Yes")
}

setInterval(exports.updateTime, 1800000)
setInterval(exports.manualKeepAlive, 30000);
exports.updateTime();

/////////////////////////////////
//// MQTT subscription //////////
/////////////////////////////////

module.exports.mqttCN = function () {
	console.log("mqtt connected")
	mqttClient.on('connect', function () {
		mqttClient.subscribe('connectivity/+')
		mqttClient.subscribe('Lock/+')
		mqttClient.subscribe('coinIn/+')
		mqttClient.subscribe('detDrop/+')
		mqttClient.subscribe('versionFeed/+')
	})
}

//////////////////////////////////
///// MQTT subscription event ////
//////////////////////////////////

module.exports.mqttSUB = function (VI, pricing) {
	console.log("mqtt subscribe")
	mqttClient.on('message', function (topic, message) {
		// To check the connectivity of each devices 
		if (topic.match(/connectivity/g)) {
			var pattern = /connectivity\/([0-9a-zA-Z_]+)/i
			var mchNo = topic.replace(pattern, "$1")
			if (message.toString() == "ON") {
				VI[mchNo].active = true
				//console.log("Bee~")
			} else if (message.toString() == "OFF") {
				console.log("devices "+VI[mchNo].machineName+" disconnected");
				VI[mchNo].active = false
			}
		// To check whether the machine is running or not 
		} else if (topic.match(/Lock/g)) {
			db.serialize(function() {
				let sql = 'SELECT * FROM pricing WHERE outlet = ?';
				db.all(sql, [outlet.name], function(err, row) {
					if (err) {
			    		return console.error(err.message);
			  		}
			  		pricing_data = Object.assign({}, row[0]);
			  		//console.log(pricing_data)
					var pattern = /Lock\/([0-9a-zA-Z_]+)/i
					var mchNo = topic.replace(pattern, "$1")
					if (VI[mchNo].typeOfMachine.match(/dryer/g)) {
						var kgPattern = /[0-9]+kg/g
						//console.log(kgPattern)
						var kg = VI[mchNo].typeOfMachine.match(kgPattern)
						//console.log(kg)
						var dryPrice = "dry"+kg 
						//console.log(dryPrice)
						var oneRunTime = pricing_data[dryPrice]
					}
					// condition for dex double dryer 
					if (VI[mchNo].typeOfMachine.match(/dex_dryer_double/g)) {
						if (message.toString().match(/Locked1/g)) {
							var pattern1 = /Locked1\_([0-9]+)\_[0-9]+/i
							var pattern2 = /Locked1\_[0-9]+\_([0-9]+)/i
							var timeHappened = parseInt(message.toString().replace(pattern1, "$1"))
							var coinrcv = message.toString().replace(pattern2, "$1")
							console.log(timeHappened)
							VI[mchNo].startTime.upper = moment(timeHappened).format("DD/MM/YYYY HH:mm:ss")
							console.log("start time = " + VI[mchNo].startTime.upper)
							//console.log(coinrcv);
							VI[mchNo].coinPaid = VI[mchNo].coinPaid + parseInt(coinrcv)
							VI[mchNo].amountPaid = VI[mchNo].amountPaid + parseInt(coinrcv)
							VI[mchNo].locked.upper = true	
							VI[mchNo].coinPaidTop = VI[mchNo].coinPaid
							VI[mchNo].wechatPaidTop = VI[mchNo].wechatPaid
							VI[mchNo].epayPaidTop = VI[mchNo].epayPaid
							VI[mchNo].manualPaidTop = VI[mchNo].manualPaid
							VI[mchNo].amountPaidTop = VI[mchNo].amountPaid
							VI[mchNo].cutOffTC = VI[mchNo].cutOffTC + parseInt(coinrcv)
							if (VI[mchNo].wechatPaid != 0) {
								VI[mchNo].cutOffTC = VI[mchNo].cutOffTC - VI[mchNo].wechatPaid;
							} 
							if (VI[mchNo].manualPaid != 0) {
								VI[mchNo].cutOffTC = VI[mchNo].cutOffTC - VI[mchNo].manualPaid;
							} 
							if (VI[mchNo].epayPaid != 0) {
								VI[mchNo].cutOffTC = VI[mchNo].cutOffTC - VI[mchNo].epayPaid;
							}
							//(mchNo, cpd, cp, wpd, wp, epd, ep, mpd, mp, apd, ap, std, st, ld, l, tob)
							exports.updateTotalDoubleLocked(mchNo, VI[mchNo].coinPaidTop, 0, VI[mchNo].wechatPaidTop, 0, VI[mchNo].epayPaidTop, 0, VI[mchNo].manualPaidTop, 0, VI[mchNo].amountPaidTop, 0, VI[mchNo].startTime.upper, 0, 1, 0, "top")
							exports.updateCutOfftotal(mchNo, "totalCoin", VI[mchNo].cutOffTC)
							VI[mchNo].wechatPaidtmp = VI[mchNo].manualPaidtmp = VI[mchNo].epayPaidtmp = 0;
							VI[mchNo].coinPaid = 0; VI[mchNo].wechatPaid = 0; VI[mchNo].epayPaid = 0; VI[mchNo].amountPaid = 0; VI[mchNo].manualPaid = 0;
							//console.log("startTime = " + VI[mchNo].startTime.upper)
						} else if (message.toString().match(/Locked2/g)) {
							var pattern1 = /Locked2\_([0-9]+)\_[0-9]+/i
							var pattern2 = /Locked2\_[0-9]+\_([0-9]+)/i
							var timeHappened = parseInt(message.toString().replace(pattern1, "$1"))
							var coinrcv = message.toString().replace(pattern2, "$1")
							VI[mchNo].startTime.lower = moment(timeHappened).format("DD/MM/YYYY HH:mm:ss")
							console.log("start time = " + VI[mchNo].startTime.lower)
							console.log(coinrcv);
							VI[mchNo].coinPaid = VI[mchNo].coinPaid + parseInt(coinrcv)
							VI[mchNo].amountPaid = VI[mchNo].amountPaid + parseInt(coinrcv)
							VI[mchNo].locked.lower = true
							VI[mchNo].coinPaidBot = VI[mchNo].coinPaid
							VI[mchNo].wechatPaidBot = VI[mchNo].wechatPaid
							VI[mchNo].epayPaidBot = VI[mchNo].epayPaid
							VI[mchNo].manualPaidBot = VI[mchNo].manualPaid
							VI[mchNo].amountPaidBot = VI[mchNo].amountPaid
							VI[mchNo].cutOffTC = VI[mchNo].cutOffTC + parseInt(coinrcv)
							if (VI[mchNo].wechatPaid != 0) {
								VI[mchNo].cutOffTC = VI[mchNo].cutOffTC - VI[mchNo].wechatPaid;
							} 
							if (VI[mchNo].manualPaid != 0) {
								VI[mchNo].cutOffTC = VI[mchNo].cutOffTC - VI[mchNo].manualPaid;
							} 
							if (VI[mchNo].epayPaid != 0) {
								VI[mchNo].cutOffTC = VI[mchNo].cutOffTC - VI[mchNo].epayPaid;
							}
							exports.updateCutOfftotal(mchNo, "totalCoin", VI[mchNo].cutOffTC)
							VI[mchNo].wechatPaidtmp = VI[mchNo].manualPaidtmp = VI[mchNo].epayPaidtmp = 0;
							VI[mchNo].coinPaid = 0; VI[mchNo].wechatPaid = 0; VI[mchNo].epayPaid = 0; VI[mchNo].amountPaid = 0; VI[mchNo].manualPaid = 0;
							//(mchNo, cpd, cp, wpd, wp, epd, ep, mpd, mp, apd, ap, std, st, ld, l, tob)
							exports.updateTotalDoubleLocked(mchNo, VI[mchNo].coinPaidBot, 0, VI[mchNo].wechatPaidBot, 0, VI[mchNo].epayPaidBot, 0,  VI[mchNo].manualPaidBot, 0, VI[mchNo].amountPaidBot, 0, VI[mchNo].startTime.lower, 0, 1, 0, "bot")
							//console.log("startTime = " + VI[mchNo].startTime.lower)
						} else if (message.toString().match(/Unlocked1/g)) {
							if (VI[mchNo].locked.upper) {
								var pattern1 = /Unlocked1\_([0-9]+)\_[0-9]+/i
								var pattern2 = /Unlocked1\_[0-9]+\_([0-9]+)/i
								var timeHappened = parseInt(message.toString().replace(pattern1, "$1"))
								var coinrcv = message.toString().replace(pattern2, "$1")
								VI[mchNo].coinPaid = VI[mchNo].coinPaid + parseInt(coinrcv)
								VI[mchNo].amountPaid = VI[mchNo].amountPaid + parseInt(coinrcv)
								VI[mchNo].cutOffTC = VI[mchNo].cutOffTC + parseInt(coinrcv)
								if(parseInt(coinrcv) != 0) {
									if (VI[mchNo].wechatPaid != 0) {
										VI[mchNo].cutOffTC = VI[mchNo].cutOffTC - VI[mchNo].wechatPaid;
									} 
									if (VI[mchNo].manualPaid != 0) {
										VI[mchNo].cutOffTC = VI[mchNo].cutOffTC - VI[mchNo].manualPaid;
									} 
									if (VI[mchNo].epayPaid != 0) {
										VI[mchNo].cutOffTC = VI[mchNo].cutOffTC - VI[mchNo].epayPaid;
									}
								}
								exports.updateCutOfftotal(mchNo, "totalCoin", VI[mchNo].cutOffTC)
								VI[mchNo].doneTime.upper = moment(timeHappened).format("DD/MM/YYYY HH:mm:ss")
								if (VI[mchNo].amountPaid != 0) {
									if (VI[mchNo].locked.lower) {
										VI[mchNo].coinPaidBot = VI[mchNo].coinPaidBot + VI[mchNo].coinPaid
										VI[mchNo].wechatPaidBot = VI[mchNo].wechatPaidBot + VI[mchNo].wechatPaid
										VI[mchNo].epayPaidBot = VI[mchNo].epayPaidBot + VI[mchNo].epayPaid
										VI[mchNo].manualPaidBot = VI[mchNo].manualPaidBot + VI[mchNo].manualPaid
										VI[mchNo].amountPaidBot = VI[mchNo].amountPaidBot + VI[mchNo].amountPaid
										VI[mchNo].wechatPaid = VI[mchNo].coinPaid = VI[mchNo].epayPaid = VI[mchNo].manualPaid = VI[mchNo].amountPaid = 0
									} else {
										VI[mchNo].coinPaidTop = VI[mchNo].coinPaidTop + VI[mchNo].coinPaid
										VI[mchNo].wechatPaidTop = VI[mchNo].wechatPaidTop + VI[mchNo].wechatPaid
										VI[mchNo].epayPaidTop = VI[mchNo].epayPaidTop + VI[mchNo].epayPaid
										VI[mchNo].manualPaidTop = VI[mchNo].manualPaidTop + VI[mchNo].manualPaid
										VI[mchNo].amountPaidTop = VI[mchNo].amountPaidTop + VI[mchNo].amountPaid
										VI[mchNo].wechatPaid = VI[mchNo].coinPaid = VI[mchNo].epayPaid = VI[mchNo].manualPaid = VI[mchNo].amountPaid = 0
									}
									VI[mchNo].wechatPaidtmp = VI[mchNo].manualPaidtmp = VI[mchNo].epayPaidtmp = 0;
									//(mchNo, cp, wp, ep, mp, ap, st, l, ml, ms, md, type)
									exports.resetTotal(mchNo, 0, 0, 0, 0, 0, "NA", 0, 0, 0, 0, "single")
								}
								if (VI[mchNo].wechatPaidTop != 0) {
									VI[mchNo].coinPaidTop = VI[mchNo].coinPaidTop - VI[mchNo].wechatPaidTop
									VI[mchNo].amountPaidTop = VI[mchNo].amountPaidTop - VI[mchNo].wechatPaidTop
								}
								if (VI[mchNo].manualPaidTop != 0) {
									VI[mchNo].coinPaidTop = VI[mchNo].coinPaidTop - VI[mchNo].manualPaidTop
									VI[mchNo].amountPaidTop = VI[mchNo].amountPaidTop - VI[mchNo].manualPaidTop
								}
								if (VI[mchNo].epayPaidTop != 0) {
									VI[mchNo].coinPaidTop = VI[mchNo].coinPaidTop - VI[mchNo].epayPaidTop
									VI[mchNo].amountPaidTop = VI[mchNo].amountPaidTop - VI[mchNo].epayPaidTop
								}
								// wait until the firmware update its been confirmed 	
								var expectedRunTime =  VI[mchNo].amountPaidTop * oneRunTime
								VI[mchNo].totalRun = VI[mchNo].totalRun + 1
								var rcvTime = moment().format("DD/MM/YYYY HH:mm:ss")
								var diff_upper = moment(VI[mchNo].doneTime.upper, "DD/MM/YYYY HH:mm:ss").diff(moment(VI[mchNo].startTime.upper, "DD/MM/YYYY HH:mm:ss"));
								var d_upper = moment.duration(diff_upper);
								var timeTaken_upper = [d_upper.hours(), d_upper.minutes(), d_upper.seconds()].join(':')
								rpting.mchRunRecord(myRunRecord, mchNo, VI[mchNo].machineName, "upper" ,VI[mchNo].totalRun, timeTaken_upper, VI[mchNo].coinPaidTop, VI[mchNo].wechatPaidTop, VI[mchNo].epayPaidTop, VI[mchNo].manualPaidTop, 0, 0, 0, "SUCCESS", rcvTime, VI[mchNo].startTime.upper, VI[mchNo].doneTime.upper)
								//console.log(myRunRecord[mchNo])
								console.log(myRunRecord[mchNo][VI[mchNo].totalRun])
								VI[mchNo].totalManual = VI[mchNo].totalManual + VI[mchNo].manualPaidTop
								VI[mchNo].totalPaid = VI[mchNo].totalPaid + VI[mchNo].amountPaidTop
								VI[mchNo].totalWechat = VI[mchNo].totalWechat + VI[mchNo].wechatPaidTop
								VI[mchNo].totalEpay = VI[mchNo].totalEpay + VI[mchNo].epayPaidTop
								VI[mchNo].totalCoin = VI[mchNo].totalCoin + VI[mchNo].coinPaidTop
								VI[mchNo].totalTime.upper = VI[mchNo].totalTime.upper + math.floor(d_upper.as('minutes'))
								//(mchNo, tm, tp, tw, te, tc, tt, ttu, ttb, tr)
								exports.updataTotal(mchNo, VI[mchNo].totalManual, VI[mchNo].totalPaid, VI[mchNo].totalWechat, VI[mchNo].totalEpay, VI[mchNo].totalCoin, 0, VI[mchNo].totalTime.upper, 0, VI[mchNo].totalRun)
								//(mchNo, cp, wp, ep, mp, art, artt, artb, ert, tr) 
								exports.updateAccumulate(mchNo, VI[mchNo].coinPaidTop, VI[mchNo].wechatPaidTop, VI[mchNo].epayPaidTop, VI[mchNo].manualPaidTop, 0, math.floor(d_upper.as('minutes')), 0, expectedRunTime, 1)
								rpting.save2csv("chkMachineRun", myRunRecord[mchNo][VI[mchNo].totalRun], rpting.uploadNothing, reports_deposit_area)
								VI[mchNo].wechatPaidTop = 0
								VI[mchNo].epayPaidTop = 0
								VI[mchNo].coinPaidTop = 0
								VI[mchNo].amountPaidTop = 0
								VI[mchNo].manualPaidTop = 0
								//mchNo, cp, wp, ep, mp, ap, st, l, ml, ms, md, type
								exports.resetTotal(mchNo, 0, 0, 0, 0, 0, "NA", 0, 0, 0, 0, "doubleTop")
								console.log("doneTime = " + VI[mchNo].doneTime.upper)
								console.log(timeTaken_upper)
								VI[mchNo].locked.upper = false
							} else {
								VI[mchNo].locked.upper = false
								exports.updatetotal(mchNo, "lockedTop", 0)
							}
						} else if (message.toString().match(/Unlocked2/g)) {
							if (VI[mchNo].locked.lower) {
								var pattern1 = /Unlocked2\_([0-9]+)\_[0-9]+/i
								var pattern2 = /Unlocked2\_[0-9]+\_([0-9]+)/i
								var timeHappened = parseInt(message.toString().replace(pattern1, "$1"))
								var coinrcv = message.toString().replace(pattern2, "$1")
								VI[mchNo].coinPaid = VI[mchNo].coinPaid + parseInt(coinrcv)
								VI[mchNo].amountPaid = VI[mchNo].amountPaid + parseInt(coinrcv)
								VI[mchNo].cutOffTC = VI[mchNo].cutOffTC + parseInt(coinrcv)
								if(parseInt(coinrcv) != 0) {
									if (VI[mchNo].wechatPaid != 0) {
										VI[mchNo].cutOffTC = VI[mchNo].cutOffTC - VI[mchNo].wechatPaid;
									} 
									if (VI[mchNo].manualPaid != 0) {
										VI[mchNo].cutOffTC = VI[mchNo].cutOffTC - VI[mchNo].manualPaid;
									} 
									if (VI[mchNo].epayPaid != 0) {
										VI[mchNo].cutOffTC = VI[mchNo].cutOffTC - VI[mchNo].epayPaid;
									}
								}
								exports.updateCutOfftotal(mchNo, "totalCoin", VI[mchNo].cutOffTC)
								VI[mchNo].doneTime.lower = moment(timeHappened).format("DD/MM/YYYY HH:mm:ss")
								if (VI[mchNo].amountPaid != 0) {
									if (VI[mchNo].locked.upper) {
										VI[mchNo].coinPaidTop = VI[mchNo].coinPaidTop + VI[mchNo].coinPaid
										VI[mchNo].wechatPaidTop = VI[mchNo].wechatPaidTop + VI[mchNo].wechatPaid
										VI[mchNo].epayPaidTop = VI[mchNo].epayPaidTop + VI[mchNo].epayPaid
										VI[mchNo].manualPaidTop = VI[mchNo].manualPaidTop + VI[mchNo].manualPaid
										VI[mchNo].amountPaidTop = VI[mchNo].amountPaidTop + VI[mchNo].amountPaid
										VI[mchNo].wechatPaid = VI[mchNo].epayPaid = VI[mchNo].coinPaid = VI[mchNo].manualPaid = VI[mchNo].amountPaid = 0
									} else {
										VI[mchNo].coinPaidBot = VI[mchNo].coinPaidBot + VI[mchNo].coinPaid
										VI[mchNo].wechatPaidBot = VI[mchNo].wechatPaidBot + VI[mchNo].wechatPaid
										VI[mchNo].epayPaidBot = VI[mchNo].epayPaidBot + VI[mchNo].epayPaid
										VI[mchNo].manualPaidBot = VI[mchNo].manualPaidBot + VI[mchNo].manualPaid
										VI[mchNo].amountPaidBot = VI[mchNo].amountPaidBot + VI[mchNo].amountPaid
										VI[mchNo].wechatPaid = VI[mchNo].epayPaid = VI[mchNo].coinPaid = VI[mchNo].manualPaid = VI[mchNo].amountPaid = 0
									}
									VI[mchNo].wechatPaidtmp = VI[mchNo].manualPaidtmp = VI[mchNo].epayPaidtmp = 0;
									//mchNo, cp, wp, ep, mp, ap, st, l, ml, ms, md, type
									exports.resetTotal(mchNo, 0, 0, 0, 0, 0, "NA", 0, 0, 0, 0, "single")
								}
								if (VI[mchNo].wechatPaidBot != 0) {
									VI[mchNo].coinPaidBot = VI[mchNo].coinPaidBot - VI[mchNo].wechatPaidBot
									VI[mchNo].amountPaidBot = VI[mchNo].amountPaidBot - VI[mchNo].wechatPaidBot
								}
								if (VI[mchNo].manualPaidBot != 0) {
									VI[mchNo].coinPaidBot = VI[mchNo].coinPaidBot - VI[mchNo].manualPaidBot
									VI[mchNo].amountPaidBot = VI[mchNo].amountPaidBot - VI[mchNo].manualPaidBot
								}
								if (VI[mchNo].epayPaidBot != 0) {
									VI[mchNo].coinPaidBot = VI[mchNo].coinPaidBot - VI[mchNo].epayPaidBot
									VI[mchNo].amountPaidBot = VI[mchNo].amountPaidBot - VI[mchNo].epayPaidBot
								}
								var expectedRunTime =  VI[mchNo].amountPaidBot * oneRunTime
								VI[mchNo].totalRun = VI[mchNo].totalRun + 1
								var rcvTime = moment().format("DD/MM/YYYY HH:mm:ss")
								var diff_lower = moment(VI[mchNo].doneTime.lower, "DD/MM/YYYY HH:mm:ss").diff(moment(VI[mchNo].startTime.lower, "DD/MM/YYYY HH:mm:ss"));
								var d_lower = moment.duration(diff_lower);
								var timeTaken_lower = [d_lower.hours(), d_lower.minutes(), d_lower.seconds()].join(':')
								rpting.mchRunRecord(myRunRecord, mchNo, VI[mchNo].machineName, "lower", VI[mchNo].totalRun, timeTaken_lower, VI[mchNo].coinPaidBot, VI[mchNo].wechatPaidBot, VI[mchNo].epayPaidBot, VI[mchNo].manualPaidBot, 0, 0, 0, "SUCCESS", rcvTime, VI[mchNo].startTime.lower, VI[mchNo].doneTime.lower)
								//console.log(myRunRecord[mchNo])
								console.log(myRunRecord[mchNo][VI[mchNo].totalRun])
								VI[mchNo].totalManual = VI[mchNo].totalManual + VI[mchNo].manualPaidBot
								VI[mchNo].totalPaid = VI[mchNo].totalPaid + VI[mchNo].amountPaidBot
								VI[mchNo].totalWechat = VI[mchNo].totalWechat + VI[mchNo].wechatPaidBot
								VI[mchNo].totalEpay = VI[mchNo].totalEpay + VI[mchNo].epayPaidBot
								VI[mchNo].totalCoin = VI[mchNo].totalCoin + VI[mchNo].coinPaidBot
								VI[mchNo].totalTime.lower = VI[mchNo].totalTime.lower + math.floor(d_lower.as('minutes'))
								//(mchNo, tm, tp, tw, tc, tt, ttu, ttb, tr)
								exports.updataTotal(mchNo, VI[mchNo].totalManual, VI[mchNo].totalPaid, VI[mchNo].totalWechat, VI[mchNo].totalEpay, VI[mchNo].totalCoin, 0, 0, VI[mchNo].totalTime.lower,  VI[mchNo].totalRun)
								//(mchNo, cp, wp, mp, art, artt, artb, ert, tr) 
								exports.updateAccumulate(mchNo, VI[mchNo].coinPaidBot, VI[mchNo].wechatPaidBot, VI[mchNo].epayPaidBot, VI[mchNo].manualPaidBot, 0, 0, math.floor(d_lower.as('minutes')), expectedRunTime, 1)
								rpting.save2csv("chkMachineRun", myRunRecord[mchNo][VI[mchNo].totalRun], rpting.uploadNothing, reports_deposit_area)
								VI[mchNo].coinPaidBot = 0
								VI[mchNo].wechatPaidBot = 0
								VI[mchNo].epayPaidBot = 0
								VI[mchNo].amountPaidBot = 0
								VI[mchNo].manualPaidBot = 0
								//mchNo, cp, wp, ep, mp, ap, st, l, ml, ms, md, type
								exports.resetTotal(mchNo, 0, 0, 0, 0, 0, "NA", 0, 0, 0, 0, "doubleBot")
								console.log("doneTime = " + VI[mchNo].doneTime.lower)
								console.log(timeTaken_lower)
								VI[mchNo].locked.lower = false
							} else {
								VI[mchNo].locked.lower = false
								exports.updatetotal(mchNo, "lockedBot", 0)
							}
						}
					} else {
						if (message.toString().match(/Locked/g)) {
							var pattern1 = /Locked\_([0-9]+)\_[0-9]+/i
							var pattern2 = /Locked\_[0-9]+\_([0-9]+)/i
							var timeHappened = parseInt(message.toString().replace(pattern1, "$1"))
							var coinrcv = message.toString().replace(pattern2, "$1")
							VI[mchNo].startTime = moment(timeHappened).format("DD/MM/YYYY HH:mm:ss")
							console.log("start time = " + VI[mchNo].startTime)
							console.log(coinrcv);
							VI[mchNo].coinPaid = VI[mchNo].coinPaid + parseInt(coinrcv)
							VI[mchNo].amountPaid = VI[mchNo].amountPaid + parseInt(coinrcv)
							VI[mchNo].cutOffTC = VI[mchNo].cutOffTC + parseInt(coinrcv)
							if (VI[mchNo].wechatPaidtmp != 0) {
								VI[mchNo].cutOffTC = VI[mchNo].cutOffTC - VI[mchNo].wechatPaidtmp;
							} 
							if (VI[mchNo].manualPaidtmp != 0) {
								VI[mchNo].cutOffTC = VI[mchNo].cutOffTC - VI[mchNo].manualPaidtmp;
							} 
							if (VI[mchNo].epayPaidtmp != 0) {
								VI[mchNo].cutOffTC = VI[mchNo].cutOffTC - VI[mchNo].epayPaidtmp;
							}
							VI[mchNo].wechatPaidtmp = VI[mchNo].manualPaidtmp = VI[mchNo].epayPaidtmp = 0;
							exports.updateCutOfftotal(mchNo, "totalCoin", VI[mchNo].cutOffTC)
							VI[mchNo].locked = true
							//(mchNo, cpd, cp, wpd, wp, epd, ep, mpd, mp, apd, ap, std, st, ld, l, tob)
							exports.updateMoney(mchNo, VI[mchNo].coinPaid, 0, 0, 0, VI[mchNo].amountPaid, 0, 0, 0, 0, 0, "Coin")
							exports.updateTotalDoubleLocked(mchNo, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, VI[mchNo].startTime, 0, 1, "single")
						} else if (message.toString().match(/Unlocked/g)) {
							if (VI[mchNo].locked) {
								var pattern1 = /Unlocked\_([0-9]+)\_[0-9]+/i
								var pattern2 = /Unlocked\_[0-9]+\_([0-9]+)/i
								var timeHappened = parseInt(message.toString().replace(pattern1, "$1"))
								var coinrcv = message.toString().replace(pattern2, "$1")
								VI[mchNo].coinPaid = VI[mchNo].coinPaid + parseInt(coinrcv)
								VI[mchNo].amountPaid = VI[mchNo].amountPaid + parseInt(coinrcv)
								VI[mchNo].cutOffTC = VI[mchNo].cutOffTC + parseInt(coinrcv)
								if (parseInt(coinrcv) != 0) {
									if (VI[mchNo].wechatPaidtmp != 0) {
										VI[mchNo].cutOffTC = VI[mchNo].cutOffTC - VI[mchNo].wechatPaidtmp;
									} 
									if (VI[mchNo].manualPaidtmp != 0) {
										VI[mchNo].cutOffTC = VI[mchNo].cutOffTC - VI[mchNo].manualPaidtmp;
									} 
									if (VI[mchNo].epayPaidtmp != 0) {
										VI[mchNo].cutOffTC = VI[mchNo].cutOffTC - VI[mchNo].epayPaidtmp;
									}
								}
								VI[mchNo].wechatPaidtmp = VI[mchNo].manualPaidtmp = VI[mchNo].epayPaidtmp = 0;
								exports.updateCutOfftotal(mchNo, "totalCoin", VI[mchNo].cutOffTC)
								VI[mchNo].doneTime = moment(timeHappened).format("DD/MM/YYYY HH:mm:ss")
								var rcvTime = moment().format("DD/MM/YYYY HH:mm:ss")
								VI[mchNo].totalRun = VI[mchNo].totalRun + 1
								var diff = moment(VI[mchNo].doneTime, "DD/MM/YYYY HH:mm:ss").diff(moment(VI[mchNo].startTime, "DD/MM/YYYY HH:mm:ss"));
								var d = moment.duration(diff);
								var timeTaken = [d.hours(), d.minutes(), d.seconds()].join(':')
								//// wait until the firmware update its been confirmed 
								if (VI[mchNo].wechatPaid != 0) {
									VI[mchNo].coinPaid = VI[mchNo].coinPaid - VI[mchNo].wechatPaid
									VI[mchNo].amountPaid = VI[mchNo].amountPaid - VI[mchNo].wechatPaid
								}
								if (VI[mchNo].manualPaid != 0) {
									VI[mchNo].coinPaid = VI[mchNo].coinPaid - VI[mchNo].manualPaid
									VI[mchNo].amountPaid = VI[mchNo].amountPaid - VI[mchNo].manualPaid
								}
								if (VI[mchNo].epayPaid != 0) {
									VI[mchNo].coinPaid = VI[mchNo].coinPaid - VI[mchNo].epayPaid
									VI[mchNo].amountPaid = VI[mchNo].amountPaid - VI[mchNo].epayPaid
								}
								rpting.mchRunRecord(myRunRecord, mchNo, VI[mchNo].machineName, "NA", VI[mchNo].totalRun, timeTaken, VI[mchNo].coinPaid, VI[mchNo].wechatPaid, VI[mchNo].epayPaid, VI[mchNo].manualPaid, 0, 0, 0, "SUCCESS", rcvTime, VI[mchNo].startTime, VI[mchNo].doneTime)
								//console.log(myRunRecord[mchNo])
								console.log(myRunRecord[mchNo][VI[mchNo].totalRun])
								VI[mchNo].totalPaid = VI[mchNo].totalPaid + VI[mchNo].amountPaid
								VI[mchNo].totalWechat = VI[mchNo].totalWechat + VI[mchNo].wechatPaid
								VI[mchNo].totalEpay = VI[mchNo].totalEpay + VI[mchNo].epayPaid
								VI[mchNo].totalCoin = VI[mchNo].totalCoin + VI[mchNo].coinPaid
								VI[mchNo].totalTime = VI[mchNo].totalTime + math.floor(d.as('minutes'))
								VI[mchNo].totalManual = VI[mchNo].totalManual + VI[mchNo].manualPaid
								console.log(VI[mchNo])
								//(mchNo, tm, tp, tw, tc, tt, ttu, ttb, tr)
								exports.updataTotal(mchNo, VI[mchNo].totalManual, VI[mchNo].totalPaid, VI[mchNo].totalWechat, VI[mchNo].totalEpay, VI[mchNo].totalCoin, VI[mchNo].totalTime, 0, 0,  VI[mchNo].totalRun)
								rpting.save2csv("chkMachineRun", myRunRecord[mchNo][VI[mchNo].totalRun], rpting.uploadNothing, reports_deposit_area)
								if (VI[mchNo].typeOfMachine.match(/Washer/g)) {
									var expectedRunTime = VI[mchNo].oneRunTime
									var pattern = /[0-9]+kg/g
									var mchKg = VI[mchNo].typeOfMachine.match(pattern)
									var mchKgCold = "cold"+mchKg
									var mchKgWarm = "warm"+mchKg
									var mchKgHot = "hot"+mchKg
									var newLine = "\r\n";
									//console.log(mchKgCold+" "+mchKgWarm+" "+mchKgHot)
									//console.log(pricing_data)
									if (VI[mchNo].amountPaid == pricing_data[mchKgCold]) {
										VI[mchNo].coldRun = VI[mchNo].coldRun + 1;
										exports.updatetotal(mchNo, "totalColdRun", VI[mchNo].coldRun)
										exports.updateAccumulative(mchNo, "No_Cold_Run", 1)
									} else if (VI[mchNo].amountPaid == pricing_data[mchKgWarm]) {
										VI[mchNo].warmRun = VI[mchNo].warmRun + 1;
										exports.updatetotal(mchNo, "totalWarmRun", VI[mchNo].warmRun)
										exports.updateAccumulative(mchNo, "No_Warm_Run", 1)
									} else if (VI[mchNo].amountPaid == pricing_data[mchKgHot]) {
										VI[mchNo].hotRun = VI[mchNo].hotRun + 1;
										exports.updatetotal(mchNo, "totalHotRun", VI[mchNo].hotRun)
										exports.updateAccumulative(mchNo, "No_Hot_Run", 1)
									} else {
										VI[mchNo].otherRun = VI[mchNo].otherRun + 1;
										exports.updatetotal(mchNo, "totalOtherRun", VI[mchNo].otherRun)
										exports.updateAccumulative(mchNo, "No_Other_Run", 1)
									}
									exports.updateAccumulative(mchNo, "Expected_Total_Run_Time", expectedRunTime)
								} else if (VI[mchNo].typeOfMachine.match(/dryer/g)) {
									var expectedRunTime =  VI[mchNo].amountPaid * oneRunTime
									exports.updateAccumulative(mchNo, "Expected_Total_Run_Time", expectedRunTime)
								}
								//(mchNo, cp, wp, mp, art, artt, artb, ert, tr) 
								exports.updateAccumulate(mchNo, VI[mchNo].coinPaid, VI[mchNo].wechatPaid, VI[mchNo].epayPaid, VI[mchNo].manualPaid, math.floor(d.as('minutes')), 0, 0, expectedRunTime, 1)
								VI[mchNo].coinPaid = 0
								VI[mchNo].wechatPaid = 0
								VI[mchNo].epayPaid = 0
								VI[mchNo].amountPaid = 0
								VI[mchNo].manualPaid = 0
								//mchNo, cp, wp, ep, mp, ap, st, l, ml, ms, md, type
								exports.resetTotal(mchNo, 0, 0, 0, 0, 0, "NA", 0, 0, 0, 0, "single")
								console.log("doneTime = " + VI[mchNo].doneTime)
								console.log(timeTaken)
								VI[mchNo].locked = false
							} else {
								VI[mchNo].locked = false
								exports.updatetotal(mchNo, "locked", 0)
							}
						}	
					}
					console.log(message.toString() + "  " + mchNo)
				})
			})
		// to check the det drop event 
		} else if (topic.match(/detDrop/g)) {
			var pattern = /detDrop\/([0-9a-zA-Z_]+)/i
			var mchNo = topic.replace(pattern, "$1")
			//console.log(VI[mchNo].locked)
			var pattern1 = /[A-Z_]+\_([0-9]+)\_[0-9]+/i
			var pattern2 = /[A-Z_]+\_[0-9]+\_([0-9]+)/i
			var pattern3 = /([A-Z_]+)\_[0-9]+\_[0-9]+/i
			var timeHappened = parseInt(message.toString().replace(pattern1, "$1"))
			var coinrcv = message.toString().replace(pattern2, "$1")
			var itemDrop = message.toString().replace(pattern3, "$1")
			VI[mchNo].coinPaid = VI[mchNo].coinPaid + parseInt(coinrcv)
			VI[mchNo].amountPaid = VI[mchNo].amountPaid + parseInt(coinrcv)
			VI[mchNo].totalCoin = VI[mchNo].totalCoin + parseInt(coinrcv)
			VI[mchNo].totalPaid = VI[mchNo].totalPaid + parseInt(coinrcv)
			VI[mchNo].cutOffTC = VI[mchNo].cutOffTC + parseInt(coinrcv)
			if (VI[mchNo].wechatPaidtmp != 0) {
				VI[mchNo].coinPaid = VI[mchNo].coinPaid - VI[mchNo].wechatPaidtmp
				VI[mchNo].amountPaid = VI[mchNo].amountPaid - VI[mchNo].wechatPaidtmp
				VI[mchNo].totalCoin = VI[mchNo].totalCoin - VI[mchNo].wechatPaidtmp
				VI[mchNo].totalPaid = VI[mchNo].totalPaid - VI[mchNo].wechatPaidtmp
				VI[mchNo].cutOffTC = VI[mchNo].cutOffTC - VI[mchNo].wechatPaidtmp;
				VI[mchNo].totalWechat = VI[mchNo].totalWechat + VI[mchNo].wechatPaidtmp
				VI[mchNo].wechatPaid = VI[mchNo].wechatPaid + VI[mchNo].wechatPaidtmp
				VI[mchNo].wechatPaidtmp = 0;
				exports.updatetotal(mchNo, "wechatPaidtmp", VI[mchNo].wechatPaidtmp)
			}
			if (VI[mchNo].manualPaidtmp != 0) {
				VI[mchNo].coinPaid = VI[mchNo].coinPaid - VI[mchNo].manualPaidtmp
				VI[mchNo].amountPaid = VI[mchNo].amountPaid - VI[mchNo].manualPaidtmp
				VI[mchNo].totalCoin = VI[mchNo].totalCoin - VI[mchNo].manualPaidtmp
				VI[mchNo].totalPaid = VI[mchNo].totalPaid - VI[mchNo].manualPaidtmp
				VI[mchNo].cutOffTC = VI[mchNo].cutOffTC - VI[mchNo].manualPaidtmp
				VI[mchNo].manualPaid = VI[mchNo].manualPaid + VI[mchNo].manualPaidtmp
				VI[mchNo].totalManual = VI[mchNo].totalManual + VI[mchNo].manualPaidtmp
				VI[mchNo].manualPaidtmp = 0;
				exports.updatetotal(mchNo, "manualPaidtmp", VI[mchNo].manualPaidtmp)
			}
			if (VI[mchNo].epayPaidtmp != 0) {
				VI[mchNo].coinPaid = VI[mchNo].coinPaid - VI[mchNo].epayPaidtmp
				VI[mchNo].amountPaid = VI[mchNo].amountPaid - VI[mchNo].epayPaidtmp
				VI[mchNo].totalCoin = VI[mchNo].totalCoin - VI[mchNo].epayPaidtmp
				VI[mchNo].totalPaid = VI[mchNo].totalPaid - VI[mchNo].epayPaidtmp
				VI[mchNo].cutOffTC = VI[mchNo].cutOffTC - VI[mchNo].epayPaidtmp
				VI[mchNo].totalEpay = VI[mchNo].totalEpay + VI[mchNo].epayPaidtmp
				VI[mchNo].epayPaid = VI[mchNo].epayPaid + VI[mchNo].epayPaidtmp
				VI[mchNo].epayPaidtmp = 0
				exports.updatetotal(mchNo, "epayPaidtmp", VI[mchNo].epayPaidtmp)
			}
			//mchNo, cp, wp, ep, mp, ap, tc, tw, te, tm, tp, type
			exports.updateMoney(mchNo, VI[mchNo].coinPaid, VI[mchNo].wechatPaid, VI[mchNo].epayPaid, VI[mchNo].manualPaid , VI[mchNo].amountPaid, VI[mchNo].totalCoin, VI[mchNo].totalWechat, VI[mchNo].totalEpay, VI[mchNo].totalManual, VI[mchNo].totalPaid, "all")
			exports.updateCutOfftotal(mchNo, "totalCoin", VI[mchNo].cutOffTC)
			// console.log(timeHappened)
			// console.log(coinrcv)
			// console.log(itemDrop)
			console.log(message.toString() + "  " + mchNo + " " + moment().format("DD/MM/YYYY HH:mm:ss"))
			if (itemDrop == "DTG_DROP") {
				VI[mchNo].myDet = VI[mchNo].myDet + 1
				VI[mchNo].detergent = VI[mchNo].detergent + 1
				VI[mchNo].cutOffTD = VI[mchNo].cutOffTD + 1
				exports.updateCutOfftotal(mchNo, "totalDet", VI[mchNo].cutOffTD)
				exports.updatetotal(mchNo, "myDet", VI[mchNo].myDet)
				exports.updatetotal(mchNo, "detergent", VI[mchNo].detergent)
				exports.updateAccumulative(mchNo, "totalDet", 1)
			} else if (itemDrop == "SFTNR_DROP") {
				VI[mchNo].mySoft = VI[mchNo].mySoft + 1
				VI[mchNo].softnr = VI[mchNo].softnr + 1
				VI[mchNo].cutOffTS = VI[mchNo].cutOffTS + 1
				exports.updateCutOfftotal(mchNo, "totalSoft", VI[mchNo].cutOffTS)
				exports.updatetotal(mchNo, "mySoft", VI[mchNo].mySoft)
				exports.updatetotal(mchNo, "softnr", VI[mchNo].softnr)
				exports.updateAccumulative(mchNo, "totalSoftnr", 1)
			} else if (itemDrop == "BEG_DROP") {
				VI[mchNo].myLb = VI[mchNo].myLb + 1
				VI[mchNo].beg = VI[mchNo].beg + 1
				VI[mchNo].cutOffTB = VI[mchNo].cutOffTB + 1
				exports.updateCutOfftotal(mchNo, "totalBeg", VI[mchNo].cutOffTB)
				exports.updatetotal(mchNo, "myLb", VI[mchNo].myLb)
				exports.updatetotal(mchNo, "beg", VI[mchNo].beg)
				exports.updateAccumulative(mchNo, "totalBeg", 1)
			}
			if (VI[mchNo].locked == false) {
				console.log("got things dropped")
				VI[mchNo].startTime = moment(timeHappened).format("DD/MM/YYYY HH:mm:ss")
				VI[mchNo].locked = true;
				VI[mchNo].totalRun = VI[mchNo].totalRun + 1;
				exports.updateAccumulative(mchNo, "Coin_received", parseInt(coinrcv));
				//(mchNo, cp, wp, ep, mp, ap, tc, tw, te, tm, tp, type)
				exports.updatetotal(mchNo, "totalRun", VI[mchNo].totalRun)
				exports.updatetotal(mchNo, "startTime", VI[mchNo].startTime)
				var rcvTime = moment().format("DD/MM/YYYY HH:mm:ss");
				setTimeout((function (mn) {
					return function() {
						//detRunRecord = function (myDetR, mchCode, name, noOfRun, coinPaid, wechatPaid, manualPaid, det, softnr, lb, date, Time)
						console.log("finished one round")
						rpting.mchRunRecord(myRunRecord, mn, VI[mn].machineName, "NA", VI[mn].totalRun, 0, VI[mn].coinPaid, VI[mn].wechatPaid, VI[mn].epayPaid, VI[mn].manualPaid, VI[mn].myDet, VI[mn].mySoft, VI[mn].myLb, "SUCCESS", rcvTime, VI[mchNo].startTime, "NA")
						//rpting.detRunRecord(myDetRecord, mchNo, VI[mchNo].machineName, VI[mchNo].totalRun, VI[mchNo].coinPaid, VI[mchNo].wechatPaid, VI[mchNo].manualPaid, VI[mchNo].amountPaid, VI[mchNo].myDet, VI[mchNo].mySoft, VI[mchNo].myLb, dateNow, timeNow)
						VI[mn].coinPaid = VI[mn].wechatPaid = VI[mn].epayPaid = VI[mn].manualPaid = VI[mn].amountPaid = VI[mn].myDet = VI[mn].mySoft = VI[mn].myLb = 0;
						//mchNo, cp, wp, ep, mp, ap, st, l, ml, ms, md, type
						exports.resetTotal(mn, 0, 0, 0, 0, 0, "NA", 0, 0, 0, 0, "vending")
						VI[mn].locked = false;
						console.log(myRunRecord[mn][VI[mn].totalRun])
						rpting.save2csv("chkMachineRun", myRunRecord[mn][VI[mn].totalRun], rpting.uploadNothing, reports_deposit_area)
					}
				})(mchNo), 180000)
			}
		} else if (topic.match(/versionFeed/g)) {
			exports.updateTime();
			var pattern = /versionFeed\/([0-9a-zA-Z_]+)/i
			var mchNo = topic.replace(pattern, "$1")
			console.log("Current version of the firmware of " + mchNo + " is " + message.toString())
			VI[mchNo].version = message.toString()
			exports.updatetotal(mchNo, "version", VI[mchNo].version)
		}
	})
}


////////////////////////////////////////////////////////
/////// sqlite command to update/query the database ////
////////////////////////////////////////////////////////
module.exports.updateCutOfftotal = function (mchNo, key, value) {
	let data = [value, mchNo];
	let sql = 'UPDATE cutOffTotalValue SET '+key+'= ? WHERE MchCode = ?';
	db.run(sql, data, function(err) {
		if (err) {
    		return console.error(err.message);
  		}
  		//console.log("data has been updated")
	});
}

module.exports.updateCutOfftotalAll = function (mchNo, stc, tc, std, td, stts, ts, stb, tb, st, lcft, sts, cfby) {
	let data = [stc, tc, std, td, stts, ts, stb, tb, st, lcft, sts, cfby, mchNo];
	let sql = 'UPDATE cutOffTotalValue SET cutOffTC = ?, totalCoin = ?, cutOffTD = ?, totalDet = ?, cutOffTS = ?, totalSoft = ?, cutOffTB = ?, totalBeg = ?, startTime = ?, lastCFtime = ?, mystatus = ?, cutOffBy = ? WHERE MchCode = ?';
	db.run(sql, data, function(err) {
		if (err) {
    		return console.error(err.message);
  		}
  		//console.log("data has been updated")
	});
}

module.exports.updateCutOffGrp = function (grp, cft, sts) {
	let data = [cft, sts, grp];
	let sql = 'UPDATE cutOffgroup SET cutOffTime = ?, theStatus = ? WHERE MyGroup = ?';
	db.run(sql, data, function(err) {
		if (err) {
    		return console.error(err.message);
  		}
  		//console.log("data has been updated")
	});
}

module.exports.updatetotal = function (mchNo, key, value) {
	let data = [value, mchNo];
	let sql = 'UPDATE dailyTotalValue SET '+key+'= ? WHERE MchCode = ?';
	db.run(sql, data, function(err) {
		if (err) {
    		return console.error(err.message);
  		}
  		//console.log("data has been updated")
	});
}

module.exports.updataTotal = function (mchNo, tm, tp, tw, te, tc, tt, ttu, ttb, tr) {
	let data = [tm, tp, tw, te, tc, tt, ttu, ttb, tr, mchNo]
	let sql = 'UPDATE dailyTotalValue SET totalManual = ?, totalPaid = ?, totalWechat = ?, totalEpay = ?, totalCoin = ?, totalTime = ?, totalTimeTop = ?, totalTimeBot = ?, totalRun = ? WHERE MchCode = ?'; 
	db.run(sql, data, function(err) {
		if (err) {
    		return console.error(err.message);
  		}
  		//console.log("data has been updated")
	});
}

module.exports.updateAccumulative = function (mchNo, key, value) {
	let tmpkey = key+"_tmp"
	db.serialize(function() {
		let sql = 'SELECT '+key+' '+tmpkey+' FROM uptoDateValue WHERE Machine_Code = ?';
		db.get(sql, [mchNo], function(err, row) {
			//console.log("the data is "+row[tmpkey])
			var total = row[tmpkey] + value
			if (err) {
	    		return console.error(err.message);
	  		}
	  		let sql = 'UPDATE uptoDateValue SET '+key+'= ? WHERE Machine_Code = ?';
			let data = [total, mchNo];
			db.run(sql, data, function(err) {
				if (err) {
	    			return console.error(err.message);
	  			}
	  			//console.log("up2date data has been updated")
			});
		})
	})	
}

module.exports.updateAccumulate = function (mchNo, cp, wp, ep, mp, art, artt, artb, ert, tr) {
	
	db.serialize(function() {
		let sql = 'SELECT Coin_received cr, Wechat_received wr, Epay_received er, Manual_payment mp, Actual_Total_Run_Time atrt, Actual_Total_Run_Time_Top atrtt, Actual_Total_Run_Time_Bot atrtb, Expected_Total_Run_Time etrt, Total_Run tr FROM uptoDateValue WHERE Machine_Code = ?';
		db.get(sql, [mchNo], function(err, row) {
			//console.log("the data is "+row[tmpkey])
			console.log(row)
			var total_cr = row.cr + cp;
			var total_wr = row.wr + wp;
			var total_er = row.er + ep;
			var total_mp = row.mp + mp;
			var total_atrt = row.atrt + art;
			var total_atrtt = row.atrtt + artt;
			var total_atrtb = row.atrtb + artb;
			var total_etrt = row.etrt + ert;
			var total_tr = row.tr + tr;
			if (err) {
	    		return console.error(err.message);
	  		}
	  		let sql2 = 'UPDATE uptoDateValue SET Coin_received = ?, Wechat_received = ?, Epay_received = ?, Manual_payment = ?, Actual_Total_Run_Time = ?, Actual_Total_Run_Time_Top = ?, Actual_Total_Run_Time_Bot = ?, Expected_Total_Run_Time = ?, Total_Run = ? WHERE Machine_Code = ?';
			let data2 = [total_cr, total_wr, total_er, total_mp, total_atrt, total_atrtt, total_atrtb, total_etrt, total_tr, mchNo];
			db.run(sql2, data2, function(err) {
				if (err) {
	    			return console.error(err.message);
	  			}
	  			//console.log("up2date data has been updated")
			});
		})
	})	
}

module.exports.updateTotalDoubleLocked = function (mchNo, cpd, cp, wpd, wp, epd, ep, mpd, mp, apd, ap, std, st, ld, l, tob) {
	if (tob == "top") {
		let data = [cpd, cp, wpd, wp, epd, ep, mpd, mp, apd, ap, std, ld, mchNo]
		let sql = 'UPDATE dailyTotalValue SET coinPaidTop = ?, coinPaid = ?, wechatPaidTop = ?, wechatPaid = ?, epayPaidTop = ?, epayPaid = ?, manualPaidTop = ?, manualPaid = ?, amountPaidTop = ?, amountPaid = ?, startTimeTop = ?, lockedTop = ? WHERE MchCode = ?'; 
		db.run(sql, data, function(err) {
			if (err) {
	    		return console.error(err.message);
	  		}
	  		//console.log("data has been updated")
		});
	} else if (tob == "bot") {
		let data = [cpd, cp, wpd, wp, epd, ep, mpd, mp, apd, ap, std, ld, mchNo]
		let sql = 'UPDATE dailyTotalValue SET coinPaidBot = ?, coinPaid = ?, wechatPaidBot = ?, wechatPaid = ?, epayPaidBot = ?, epayPaid = ?, manualPaidBot = ?, manualPaid = ?, amountPaidBot = ?, amountPaid = ?, startTimeBot = ?, lockedBot = ? WHERE MchCode = ?'; 
		db.run(sql, data, function(err) {
			if (err) {
	    		return console.error(err.message);
	  		}
	  		//console.log("data has been updated")
		});
	} else if (tob == "single") {
		let data = [st, l, mchNo]
		let sql = 'UPDATE dailyTotalValue SET startTime = ?, locked = ? WHERE MchCode = ?'; 
		db.run(sql, data, function(err) {
			if (err) {
	    		return console.error(err.message);
	  		}
	  		//console.log("data has been updated")
		});
	}	
}

module.exports.resetTotal = function (mchNo, cp, wp, ep, mp, ap, st, l, ml, ms, md, type) {
	if (type == "single") {
		let data = [cp, wp, ep, mp, ap, st, l, mchNo]
		let sql = 'UPDATE dailyTotalValue SET coinPaid = ?, wechatPaid = ?, epayPaid = ?, manualPaid = ?, amountPaid = ?, startTime = ?, locked = ? WHERE MchCode = ?'; 
		db.run(sql, data, function(err) {
			if (err) {
	    		return console.error(err.message);
	  		}
	  		//console.log("data has been updated")
		});
	} else if (type == "vending") {
		let data = [cp, wp, ep, mp, ap, md, ms, ml, mchNo]
		let sql = 'UPDATE dailyTotalValue SET coinPaid = ?, wechatPaid = ?, epayPaid = ?, manualPaid = ?, amountPaid = ?, myDet = ?, mySoft = ?, myLb = ? WHERE MchCode = ?'; 
		db.run(sql, data, function(err) {
			if (err) {
	    		return console.error(err.message);
	  		}
	  		//console.log("data has been updated")
		});
	} else if (type == "doubleTop") {
		let data = [cp, wp, ep, mp, ap, st, l, mchNo]
		let sql = 'UPDATE dailyTotalValue SET coinPaidTop = ?, wechatPaidTop = ?, epayPaidTop = ?, manualPaidTop = ?, amountPaidTop = ?, startTimeTop = ?, lockedTop = ? WHERE MchCode = ?'; 
		db.run(sql, data, function(err) {
			if (err) {
	    		return console.error(err.message);
	  		}
	  		//console.log("data has been updated")
		});
	} else if (type == "doubleBot") {
		let data = [cp, wp, ep, mp, ap, st, l, mchNo]
		let sql = 'UPDATE dailyTotalValue SET coinPaidBot = ?, wechatPaidBot = ?, epayPaidBot = ?, manualPaidBot = ?, amountPaidBot = ?, startTimeBot = ?, lockedBot = ? WHERE MchCode = ?'; 
		db.run(sql, data, function(err) {
			if (err) {
	    		return console.error(err.message);
	  		}
	  		//console.log("data has been updated")
		});
	}
}

module.exports.updateMoney = function (mchNo, cp, wp, ep, mp, ap, tc, tw, te, tm, tp, type) {
	if (type == "detCoin") {
		let data = [cp, tc, tp, mchNo]
		let sql = 'UPDATE dailyTotalValue SET coinPaid = ?, totalCoin = ?, totalPaid = ? WHERE MchCode = ?';
		db.run(sql, data, function(err) {
			if (err) {
	    		return console.error(err.message);
	  		}
	  		//console.log("data has been updated")
		});
	} else if (type == "Coin") {
		let data = [cp, ap, wp, ep, mp, mchNo]
		let sql = 'UPDATE dailyTotalValue SET coinPaid = ?, amountPaid = ?, wechatPaidtmp = ?, epayPaidtmp = ?, manualPaidtmp = ? WHERE MchCode = ?';
		db.run(sql, data, function(err) {
			if (err) {
	    		return console.error(err.message);
	  		}
	  		//console.log("data has been updated")
		});
	} else if (type == "detWechat") {
		let data = [wp, ap, tp, mchNo]
		let sql = 'UPDATE dailyTotalValue SET wechatPaidtmp = ?, amountPaid = ? totalPaid = ? WHERE MchCode = ?';
		db.run(sql, data, function(err) {
			if (err) {
	    		return console.error(err.message);
	  		}
	  		//console.log("data has been updated")
		});
	} else if (type == "all") {
		let data = [cp, wp, ep, mp, ap, tc, tw, te, tm, tp, mchNo]
		let sql = 'UPDATE dailyTotalValue SET coinPaid = ?, wechatPaid = ?, epayPaid = ?, manualPaid = ?, amountPaid = ?, totalCoin = ?, totalWechat = ?, totalEpay = ?, totalManual = ? totalPaid = ? WHERE MchCode = ?';
		db.run(sql, data, function(err) {
			if (err) {
	    		return console.error(err.message);
	  		}
	  		//console.log("data has been updated")
		});
	} else if (type == "detEpay") {
		let data = [ep, ap, tp, mchNo]
		let sql = 'UPDATE dailyTotalValue SET epayPaidtmp = ?, amountPaid = ?, totalPaid = ? WHERE MchCode = ?';
		db.run(sql, data, function(err) {
			if (err) {
	    		return console.error(err.message);
	  		}
	  		//console.log("data has been updated")
		});
	} else if (type == "Epay") {
		let data = [ep, ap, mchNo]
		let sql = 'UPDATE dailyTotalValue SET epayPaid = ?, amountPaid = ? WHERE MchCode = ?';
		db.run(sql, data, function(err) {
			if (err) {
	    		return console.error(err.message);
	  		}
	  		//console.log("data has been updated")
		});
	} else if (type == "Wechat") {
		let data = [wp, ap, mchNo]
		let sql = 'UPDATE dailyTotalValue SET wechatPaid = ?, amountPaid = ? WHERE MchCode = ?';
		db.run(sql, data, function(err) {
			if (err) {
	    		return console.error(err.message);
	  		}
	  		//console.log("data has been updated")
		});
	} else if (type == "detManual") {
		let data = [mp, tm, mchNo]
		let sql = 'UPDATE dailyTotalValue SET manualPaidtmp = ?, totalManual = ? WHERE MchCode = ?';
		db.run(sql, data, function(err) {
			if (err) {
	    		return console.error(err.message);
	  		}
	  		//console.log("data has been updated")
		});
	} else if (type == "Manual") {
		let data = [mp, mchNo]
		let sql = 'UPDATE dailyTotalValue SET manualPaid = ? WHERE MchCode = ?';
		db.run(sql, data, function(err) {
			if (err) {
	    		return console.error(err.message);
	  		}
	  		//console.log("data has been updated")
		});
	}
}

function querydata(mchNo, key, myVI) {
	let tmpkey = key+"_tmp"
	let sql = 'SELECT '+key+' '+tmpkey+' FROM dailyTotalValue WHERE MchCode = ?';
	return db.get(sql, [mchNo], function(err, row) {
		//console.log("the data is "+row[tmpkey])
		myVI[mchNo][key] = row[tmpkey]
		if (err) {
    		return console.error(err.message);
  		}
  		return row[tmpkey]  		
	})
}

var readRecords = function(callback){
    var db = new sqlite3.Database('./db/laundry.db', sqlite3.OPEN_READONLY);
    db.serialize(function() {
        db.all("SELECT * FROM dailyTotalValue", function(err, allRows) {
            if(err != null){
                console.log(err);
                callback(err);
            }
            console.log(util.inspect(allRows));
            callback(allRows);
            db.close();
        });
    });
}

