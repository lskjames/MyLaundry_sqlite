var moment = require('moment');
var fs = require('fs');
var json2csvParser = require('json2csv').Parser;
var myVI = require('../credentials/variables.js');
const outlet = require('../data/outlet.js')
var csv2json = require('csvtojson');
var googleapi = require('./googleapi.js')
const ftp = require('basic-ftp')
const sqlite3 = require('sqlite3').verbose();
var cross_outlet_folder = outlet.crossOutletID
var reports_deposit_area = outlet.rptFolderID
const ftp_deposit_area = '/Data/' + outlet.name
const ftp_Coinop_report = ftp_deposit_area + "/Coinop_Sales"
const ftp_det_report = ftp_deposit_area + "/Detergent"
const ftp_log_report = ftp_deposit_area + "/Log"
const ftp_cross_outlet = '/Data/' + 'cross_outlets'
const mode = "production"
const uploadMode = "FTP"

if (uploadMode == "FTP") {
	reports_deposit_area = ftp_deposit_area
	cross_outlet_folder = ftp_cross_outlet
}
var nodemailer = require('nodemailer');
var transporter = nodemailer.createTransport({
	host: 'smtp.gmail.com',
    port: 465,
    secure: true, // use SSL
	auth:{
		user: outlet.email,
		pass: outlet.gmailpw
	}
});

if (outlet.name == "PJCC") {
	outlet.host = "192.168.8.20"
} else {
	outlet.host = "pjs5.dyndns.org"
}

var sumRunRecord = {}
var sumSalesRecord = {}
var sumSalesByType = {}
var sumRunU2D = {}
var sumDetDaily = {}
var sumDetMonthly = []
var xOutletMonthly = []
var sumAllDetMonthly = []
var file2Upload = []
var detJson = {}
var totalAllOutlet = {}
var sumAmountByType = {}
var pricing_data = {}
totalAllOutlet.Outlet = "Total"
totalAllOutlet.Detergent_Unit = 0
totalAllOutlet.Detergent_Sales = 0
totalAllOutlet.Softener_Unit = 0
totalAllOutlet.Softener_Sales = 0
totalAllOutlet.LB_Unit = 0
totalAllOutlet.LB_Sales = 0

let db = new sqlite3.Database('./mydb/laundry.db', sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the laundry database.');
});

var newLine = "\r\n";
var myfields = ['title', 'method', 'amount', 'date', 'time', 'status', 'remark', 'machineCode','transId', 'payeeId']
var fields1 = ['title', 'amount', 'payeeId', 'date', 'time', 'status', 'remark', 'machineCode','transId']
var fields2 = ['no', 'name', 'side', 'runTime', 'Coin_received', 'Wechat_received', 'Epay_received', 'Manual_payment', 'Detergent', 'Softener', 'LB', 'status','date', 'startTime', 'endTime', 'machine']
var fields3 = ['Title', 'TotalCoin', 'TotalWechat', 'TotalEpay', 'TotalManual', 'TotalRun', 'NoColdRun', 'NoWarmRun', 'NoHotRun', 'NoOtherRun','ActualTotalRunTime','ActualTotalRunTimeTop', 'ActualTotalRunTimeBot', 'ExpectedTotalRunTime', 'myDate']
var fields4 = ['mydate']
Object.keys(myVI).forEach(function(k){
	//console.log(k)
	fields4.push(myVI[k].machineName+".tw")
	fields4.push(myVI[k].machineName+".te")
	fields4.push(myVI[k].machineName+".tc")
	fields4.push(myVI[k].machineName+".tp")
})
fields4.push("gtw")
fields4.push("gte")
fields4.push("gtc")
fields4.push("gtp")
var fields5 = ['date']
var fields6 = ['Title', 'Wechat_received', 'Epay_received', 'Coin_received', 'Total_Run', 'No_Cold_Run','No_Warm_Run', 'No_Hot_Run', 'No_Other_Run', 'Actual_Total_Run_Time_Top','Actual_Total_Run_Time_Bot','Actual_Total_Run_Time', 'Expected_Total_Run_Time', 'Total_Det', 'Total_Soft', 'Total_LB', 'machineCode', 'Date']
var fields7 = ['mydate']
Object.keys(myVI).forEach(function(k){
	if (myVI[k].typeOfMachine.match(/detergent/g)) {
		fields7.push(myVI[k].machineName+"tw")
		fields7.push(myVI[k].machineName+"te")
		fields7.push(myVI[k].machineName+"tc")
		fields7.push(myVI[k].machineName+"tm")
		fields7.push(myVI[k].machineName+"tp")
		fields7.push(myVI[k].machineName+"td")
		fields7.push(myVI[k].machineName+"ts")
		fields7.push(myVI[k].machineName+"tb")
		fields7.push(myVI[k].machineName+"tt")
	}
})
fields7.push('totalW', 'totalE', 'totalC', 'totalM', 'totalP','totalD', 'totalS', 'totalB', 'totalT')
var fields8 = ['type', 'Jan', 'Feb', 'Mar', 'Apr', 'may', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']
var header8 = ['Type', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']
var h8print = header8.toString() + newLine
var fields9 = ['Outlet', 'Detergent_Unit', 'Detergent_Sales', 'Softener_Unit', 'Softener_Sales', 'LB_Unit', 'LB_Sales']
var fields10 = ['Machines', 'Last_CutOff_Time', 'Current_CutOff_Time', 'Coin_Collected', 'Actual_Coin_Counted', 'Detergent_Unit_Received', 'Detergent_Unit_Counted', 'Softener_Unit_Received', 'Softener_Unit_Counted', 'Beg_Unit_Received', 'Beg_Unit_Counted', 'CutOff_by', 'Submit_by']
var fields11 = ['title', 'time', 'status', 'remark', 'machineCode','User']
var header5_1 = [""]
var header5_2 = ["Date"]
var tmpVerify = {}
Object.keys(myVI).forEach(function(k) {
	if (myVI[k].typeOfMachine.match(/dryer/g)) {
		var pattern = /[0-9]+kg/g
		var mchKg = myVI[k].typeOfMachine.match(pattern)
		var patternSpcf = "D"+ mchKg
		if (!tmpVerify[patternSpcf]) {
			header5_1.push("Dryer_"+mchKg)
			header5_1.push("")
			header5_1.push("")
			header5_1.push("")
			header5_2.push("Wechat")
			header5_2.push("Epay")
			header5_2.push("Coin")
			header5_2.push("Total")
			fields5.push("D"+mchKg+"W")
			fields5.push("D"+mchKg+"E")
			fields5.push("D"+mchKg+"C")
			fields5.push("D"+mchKg+"T")
			tmpVerify[patternSpcf] = "done"
		}
	} else if (myVI[k].typeOfMachine.match(/Washer/g)){
		var pattern = /[0-9]+kg/g
		var mchKg = myVI[k].typeOfMachine.match(pattern)
		var patternSpcf = "W"+ mchKg 
		if (!tmpVerify[patternSpcf]) {
			var mchKg = myVI[k].typeOfMachine.match(pattern)
			header5_1.push("Washer_"+mchKg)
			header5_1.push("")
			header5_1.push("")
			header5_1.push("")
			header5_2.push("Wechat")
			header5_2.push("Epay")
			header5_2.push("Coin")
			header5_2.push("Total")
			fields5.push("W"+mchKg+"W")
			fields5.push("W"+mchKg+"E")
			fields5.push("W"+mchKg+"C")
			fields5.push("W"+mchKg+"T")
			tmpVerify[patternSpcf] = "done"
		}
	}
})
header5_1.push("Detergent")
header5_1.push("")
header5_1.push("")
header5_1.push("")
header5_2.push("Wechat")
header5_2.push("Epay")
header5_2.push("Coin")
header5_2.push("Total")
tmpVerify.Det = "done"
fields5.push("DetW")
fields5.push("DetE")
fields5.push("DetC")
fields5.push("DetT")
header5_1.push("Grand Total")
header5_1.push("")
header5_1.push("")
header5_1.push("")
header5_2.push("Wechat")
header5_2.push("Epay")
header5_2.push("Coin")
header5_2.push("Total")
fields5.push("totalW")
fields5.push("totalE")
fields5.push("totalC")
fields5.push("totalT")
//console.log(fields5)

var h5print1 = header5_1.toString() + newLine
var h5print2 = header5_2.toString() + newLine

var header4_1 = [""]
var header4_2 = ["Date"]
Object.keys(myVI).forEach(function(k){
	//console.log(k)
	header4_1.push(myVI[k].machineName)
	header4_1.push("")
	header4_1.push("")
	header4_1.push("")
	header4_2.push("Wechat")
	header4_2.push("Epay")
	header4_2.push("Coin")
	header4_2.push("Total")
})
header4_1.push("Grand Total")
header4_1.push("")
header4_1.push("")
header4_1.push("")
header4_2.push("Wechat")
header4_2.push("Epay")
header4_2.push("Coin")
header4_2.push("Total")
var h4print1 = header4_1.toString() + newLine
var h4print2 = header4_2.toString() + newLine

var header7_1 = [""]
var header7_2 = [""]
var header7_3 = ["Date"]

Object.keys(myVI).forEach(function(k){
	if (myVI[k].typeOfMachine.match(/detergent/g)) {
		header7_1.push(myVI[k].machineName)
		header7_1.push("")
		header7_1.push("")
		header7_1.push("")
		header7_1.push("")
		header7_1.push("")
		header7_1.push("")
		header7_1.push("")
		header7_1.push("")
	}
})
Object.keys(myVI).forEach(function(k){
	if (myVI[k].typeOfMachine.match(/detergent/g)) {
		header7_2.push("Sales Amount")
		header7_2.push("")
		header7_2.push("")
		header7_2.push("")
		header7_2.push("")
		header7_2.push("Sales Unit")
		header7_2.push("")
		header7_2.push("")
		header7_2.push("")
	}
})
Object.keys(myVI).forEach(function(k){
	if (myVI[k].typeOfMachine.match(/detergent/g)) {
		header7_3.push("Wechat")
		header7_3.push("Epay")
		header7_3.push("Coin")
		header7_3.push("Manual")
		header7_3.push("Total")
		header7_3.push("Detergent")
		header7_3.push("Softener")
		header7_3.push("LB")
		header7_3.push("Total")
	}
})

header7_1.push("Total")
header7_1.push("")
header7_1.push("")
header7_1.push("")
header7_1.push("")
header7_1.push("")
header7_1.push("")
header7_1.push("")
header7_1.push("")
header7_2.push("Sales Amount")
header7_2.push("")
header7_2.push("")
header7_2.push("")
header7_2.push("")
header7_2.push("Sales Unit")
header7_2.push("")
header7_2.push("")
header7_2.push("")
header7_3.push("Wechat")
header7_3.push("Epay")
header7_3.push("Coin")
header7_3.push("Manual")
header7_3.push("Total")
header7_3.push("Detergent")
header7_3.push("Softener")
header7_3.push("LB")
header7_3.push("Total")
var h7print1 = header7_1.toString() + newLine
var h7print2 = header7_2.toString() + newLine
var h7print3 = header7_3.toString() + newLine


const ePaymentAppend = new json2csvParser({fields: myfields, header: false});
const ePaymentCreate = new json2csvParser({fields: myfields});
const manualPayAppend = new json2csvParser({fields: fields1, header: false});
const manualPayCreate = new json2csvParser({fields: fields1});
const mchStatusAppend = new json2csvParser({fields: fields2, header: false});
const mchStatusCreate = new json2csvParser({fields: fields2});
const sumStatusAppend = new json2csvParser({fields: fields3, header: false});
const sumStatusCreate = new json2csvParser({fields: fields3});
const sumSalesDailyAppend = new json2csvParser({fields: fields4, header: false});
const sumSalesDailyCreate = new json2csvParser({fields: fields4});
const sumSalesByTypeAppend = new json2csvParser({fields: fields5, header: false});
const sumSalesByTypeCreate = new json2csvParser({fields: fields5});
const sumRunUp2dateCreate = new json2csvParser({fields: fields6});
const sumDetDailyAppend = new json2csvParser({fields: fields7, header: false});
const sumDetDailyCreate = new json2csvParser({fields: fields7});
const detMonthlyCreate = new json2csvParser({fields: fields8});
const detMonthlyAppend = new json2csvParser({fields: fields8, header: false});
const xOutletMonthlyCreate = new json2csvParser({fields: fields9});
const detMonthlyAllCreate = new json2csvParser({fields: fields8});
const detMonthlyAllAppend = new json2csvParser({fields: fields8, header: false});
const cutOffReportCreate = new json2csvParser({fields: fields10});
const cutOffReportAppend = new json2csvParser({fields: fields10, header: false});
const controlMonCreate = new json2csvParser({fields: fields11});
const controlMonAppend = new json2csvParser({fields: fields11, header: false});

const ePaymentCsv = "./reports/Epayment_Trans_" + outlet.name 
const manualPayCsv = "./reports/Manual_Payment_" + outlet.name
const chkMachineRun = "./reports/MachineRunStatus_" + outlet.name
const sumMachineRun = "./reports/DailySum_MachineRunStatus_" + outlet.name
const sumSalesDaily = "./reports/DailySum_Sales_" + outlet.name
const sumSalesTp = "./reports/DailySum_SalesByType_" + outlet.name
const sumRunUp2date = "./reports/SumRun_Up2Date_" + outlet.name
const sumDetSnU = "./reports/DailyDet_SalesUnit_" + outlet.name
const cutOffRpt= "./reports/Manual_CutOff_Report_" + outlet.name
const ctrlMntrRpt = "./reports/Monitoring_record_" + outlet.name

var detMonthly = "./reports/Det_SalesUnit_" + outlet.name
var crossOutletMonthly = "./reports/crossOutletDet_" + outlet.name 
var detMonthlyAllOutlet = "./reports/Det_SalesUnit_AllOutlet"


// fs.readFile('./credentials/credentials.json', (err, content) => {
// if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Drive API.
	//googleapi.updateOrupload(JSON.parse(content), googleapi.listFiles, sp_det_json, "sp_det_October.json" , cross_outlet_folder)
	//googleapi.updateOrupload(JSON.parse(content), googleapi.listFiles, "./cross_outlet_data/pj21_det_October.json", "pj21_det_October.json", cross_outlet_folder)
	//googleapi.updateOrupload(JSON.parse(content), googleapi.listFiles, pjcc_det_json, "pjcc_det_October.json" , cross_outlet_folder)
	//googleapi.createFolder(JSON.parse(content), "SP_Reports_Deposit_Area", googleapi.listFiles)
	//googleapi.createFolder(JSON.parse(content), "cross_outlets")
	//googleapi.download(JSON.parse(content), googleapi.downloadFiles, pj21_det_json, "pj21_det_October.json", cross_outlet_folder)
//});


//initU2Ddata(myVI, updateDailyData, saveDaily, sumRunU2D);

////////////////////////////////////////////////
////// Schedule Event //////////////////////////
////////////////////////////////////////////////

/////////// update all the daily recorded data ////////
module.exports.schedulej = function (VI) {
	console.log('The answer to life,the universe, and everything!');
	updateDailyData(VI, saveDaily);
}

//// upload the report using FTP /////
module.exports.scheduleE = function () {
	console.log("it is time to upload the reports to FTP")
	console.log(file2Upload)
	if (file2Upload != []) {
		ftpUp(file2Upload).then (function(){
			file2Upload = []
		})
	}
}

module.exports.scheduleZ = function() {
	var ytd = moment().subtract(1,'days').format("DD/MM/YYYY")
	delete sumSalesRecord[ytd];
	console.log(sumSalesRecord)
	delete sumSalesByType[ytd];
	console.log(sumSalesByType)
	delete sumDetDaily[ytd];
	console.log(sumDetDaily)
}

/////////// update the monthly detergent sales unit for this branch //////
module.exports.scheduleA = function (VI) {
	var year = moment().subtract(1,'months').format("YYYY")
	var month = moment().subtract(1,'months').format("MMMM")
	var count = 0;
	var total_det = total_soft = total_beg = amount_det = amount_soft = amount_beg = 0;
	var types = ['Detergent', 'Softener', 'LB','Amount_Det', 'Amount_Soft', 'Amount_LB']
	var length = Object.keys(types).length;
	const jsonPath = "./cross_outlet_data/"+outlet.name.toLowerCase()+"_det_"+month+".json"
	const jsonName = outlet.name.toLowerCase()+"_det_"+month+".json" 
	//console.log(length)
	db.serialize(function() {
		types.forEach(function(type, callback) {
			let sql = 'SELECT Amount amount FROM monthlyTotalValue WHERE Type = ?';
			db.get(sql, [type], function(err, row) {
				if (err) {
		    		return console.error(err.message);
		  		}
		  		if (type == "Detergent") {
		  			total_det = row.amount;
		  		} else if (type == "Softener") {
		  			total_soft = row.amount;
		  		} else if (type == "LB") {
		  			total_beg = row.amount;
		  		} else if (type == "Amount_Det") {
		  			amount_det = row.amount;
		  		} else if (type == "Amount_Soft") {
		  			amount_soft = row.amount;
		  		} else if (type == "Amount_LB") {
		  			amount_beg = row.amount;
		  		}
		  		count++;
			  	if (count == length) {
					updateDetMonthlytotal(month, total_det, total_soft, total_beg, amount_det, amount_soft, amount_beg, detMonthlyMove, sumDetMonthly)
					detMonthlyRestart();
					detJson.Detergent_Unit = total_det;
					detJson.Softener_Unit = total_soft;
					detJson.LB_Unit = total_beg;
					detJson.Detergent_Sales = amount_det;
					detJson.Softener_Sales = amount_soft;
					detJson.LB_Sales = amount_beg;
					detJson.Outlet = outlet.name;
					let data = JSON.stringify(detJson);
					var name = "./cross_outlet_data/"+ outlet.name.toLowerCase() +"_det_" + month + ".json";
					fs.writeFileSync(name, data);
					setTimeout(function () {
						if (uploadMode == "Google") {
							exports.upload2GD(jsonPath, jsonName, cross_outlet_folder)
						} else if (uploadMode == "FTP") {
							console.log("Uploading the json files")
							exports.uploadFilesFTP(jsonPath, jsonName, cross_outlet_folder)
						}
					}, 5000)
				}
		  	})
		})
	})
}

//// update the det sales unit from each branch /////

module.exports.scheduleB = function () {
	var month = moment().subtract(1,'months').format("MMMM")
	var checkCount = 0;
	const sp_det_json = "./cross_outlet_data/sp_det_"+month+".json"
	const pj21_det_json = "./cross_outlet_data/pj21_det_"+month+".json"
	const pjcc_det_json = "./cross_outlet_data/pjcc_det_"+month+".json"
	var pj21 = "pj21_det_" + month + ".json"
	var sp = "sp_det_" + month + ".json"
	if (uploadMode == "Google") {
		fs.readFile('./credentials/credentials.json', (err, content) => {
  			if (err) return console.log('Error loading client secret file:', err);
  			googleapi.download(JSON.parse(content), googleapi.downloadFiles, pj21_det_json, pj21, cross_outlet_folder)
  			googleapi.download(JSON.parse(content), googleapi.downloadFiles, sp_det_json, sp, cross_outlet_folder)
  		})
  	} else if (uploadMode == "FTP") {
		setTimeout(function () {
			exports.downloadFilesFTP(pj21_det_json, pj21, cross_outlet_folder)
		}, 5000)
		exports.downloadFilesFTP(sp_det_json, sp, cross_outlet_folder)
  	}

	var check = setInterval(function() {
		var pj21Exist = checkFiles(pj21_det_json);
		var pjccExist = checkFiles(pjcc_det_json);
		var spExist = checkFiles(sp_det_json);
		//console.log(pj21Exist+" "+pjccExist+" "+spExist)
		checkCount++;
		if (pj21Exist && pjccExist && spExist) {
			clearInterval(check)
			//console.log("All files are deposited.")
			crossOutletCombine()
		}
		if (!spExist) {
			if (uploadMode == "Google") {
				googleapi.download(JSON.parse(content), googleapi.downloadFiles, sp_det_json, sp, cross_outlet_folder)
			} else if (uploadMode == "FTP") {
				exports.downloadFilesFTP(sp_det_json, sp, cross_outlet_folder)
			}
		}
		if (!pj21Exist) {
			if (uploadMode == "Google") {
				googleapi.download(JSON.parse(content), googleapi.downloadFiles, pj21_det_json, pj21, cross_outlet_folder)
			} else if (uploadMode == "FTP") {
				exports.downloadFilesFTP(pj21_det_json, pj21, cross_outlet_folder) 
			}
		}
		if (checkCount == 5) {
			clearInterval(check);
			var mailOptions = {
				from: outlet.email,
				to: 'jamesleesukey@gmail.com',
				subject: 'There are reports not able to sync down, Please check',
				text: "pjcc file "+pjccExist+" pj21 file "+pj21Exist+" sp file "+spExist
			};
			transporter.sendMail(mailOptions, function(error, info){
				if (error) {
					console.log(error);
				} else {
					console.log('Email sent: ' + info.response);
				}
			});
		}	
	}, 20000)
}
	
//// saving the total sales unit from all outlets //////

module.exports.scheduleC = function () {
	var year = moment().subtract(1,'months').format("YYYY")
	var month = moment().subtract(1,'months').format("MMMM")
	var count = 0;
	var types = ['Detergent_Unit', 'Softener_Unit', 'LB_Unit','Detergent_Sales', 'Softener_Sales', 'LB_Sales']
	var length = Object.keys(types).length;
	var total = {}
	//console.log(length)
	types.forEach(function(type) {
		var tmp_type = type + "_tmp"
		let sql = 'SELECT '+type+' '+tmp_type+'  FROM crossOutletDet WHERE Outlet = ?';
		db.get(sql, ["Total"], function(err, row) {
			if (err) {
	    		return console.error(err.message);
	  		}
	  		total[type] = row[tmp_type]
	  		count++;
		  	if (count == length) {
		  		//console.log(total.Beg_Sales)
				updateDetMonthlyAll(month, total["Detergent_Unit"], total["Softener_Unit"], total["LB_Unit"], total["Detergent_Sales"], total["Softener_Sales"], total["LB_Sales"], allDetMonthlyMove, sumAllDetMonthly);
			}
	  	})
	})
}

module.exports.scheduleD = function (VI) {
	//console.log('Update three times a day');
	initU2Ddata(VI, updateUp2Date, sumRunU2D);
}

///// check the files availability after download them from google drive 

function checkFiles(filepath) {
	if (fs.existsSync(filepath)) {
		return true;
		//console.log("File "+filepath+" found.")
	} else {
		return false;
		//console.log("This file "+filepath+" is not exist in the path ")
	}

}

//// combine the sales unit data from each outlets through the json file downloaded 

function crossOutletCombine() {
	var month = moment().subtract(1,'months').format("MMMM")
	var pjcc_num = fs.readFileSync("./cross_outlet_data/pjcc_det_"+month+".json")
	var pjcc_json = JSON.parse(pjcc_num)
	//console.log(pjcc_json)
	var pj21_num = fs.readFileSync("./cross_outlet_data/pj21_det_"+month+".json")
	var pj21_json = JSON.parse(pj21_num)
	//console.log(pj21_json)
	var sp_num = fs.readFileSync("./cross_outlet_data/sp_det_"+month+".json")
	var sp_json = JSON.parse(sp_num)
	db.serialize(function() {
		crossOutletSave(pjcc_json, xOutletMonthly)
		crossOutletSave(pj21_json, xOutletMonthly)
		crossOutletSave(sp_json, xOutletMonthly)
		xOutletMonthly.push(totalAllOutlet)
		var types = ['Outlet', 'Detergent_Unit', 'Detergent_Sales', 'Softener_Unit', 'Softener_Sales', 'LB_Unit', 'LB_Sales']
		var outlets = ['PJCC', 'PJ21', 'SP', 'Total']
		outlets.forEach(function(outlet){
			types.forEach(function(type) {
				if (outlet == "PJCC") {
					var data = [pjcc_json[type], outlet]
				} else if (outlet == "PJ21") {
					var data = [pj21_json[type], outlet]
				} else if (outlet == "SP") {
					var data = [sp_json[type], outlet]
				} else if (outlet == "Total") {
					var data = [totalAllOutlet[type], outlet]
				}
				let sql = 'UPDATE crossOutletDet SET '+type+'= ? WHERE Outlet = ?';
				db.run(sql, data, function(err) {
					if (err) {
		    			return console.error(err.message);
		  			}
		  			//console.log("data has been updated")
				});
			})
		})
		if (uploadMode == "Google") {
			exports.save2csv("crossOutletDet", xOutletMonthly, exports.upload2GD, reports_deposit_area)
		} else if (uploadMode == "FTP") {
			exports.save2csv("crossOutletDet", xOutletMonthly, exports.uploadFilesFTP, ftp_det_report)
		}
	})
}

// update the sqlite database for a particular month on the sales unit from all outlets

function updateDetMonthlyAll(month, td, ts, tb, ad, as, ab, callback, sDM) {
	var count = 0;
	var types = ['Detergent_Unit', 'Softener_Unit', 'LB_Unit','Detergent_Sales', 'Softener_Sales', 'LB_Sales']
	const limit  = types.length;
	types.forEach(function(type) {
		if (type == "Detergent_Unit") {
  			value = td;
  		} else if (type == "Softener_Unit") {
  			value = ts;
  		} else if (type == "LB_Unit") {
  			value = tb;
  		} else if (type == "Detergent_Sales") {
  			value = ad;
  		} else if (type == "Softener_Sales") {
  			value = as;
  		} else if (type == "LB_Sales") {
  			value = ab;
  		}
  		let data = [value, type];
		let sql = 'UPDATE monthlyDetTotalAllOutlet SET '+month+'= ? WHERE Type = ?';
		db.run(sql, data, function(err) {
			if (err) {
    			return console.error(err.message);
  			}
  			//console.log("data has been updated")
  			count++;
  			if (count == limit) {
  				callback(sDM);
  			}
		});
	})
}

// update the sqlite database for a particular month on the sales unit from this particular unit 

function updateDetMonthlytotal(month, td, ts, tb, ad, as, ab, callback, sDM) {
	var count = 0;
	var types = ['Detergent', 'Softener', 'LB','Amount_Det', 'Amount_Soft', 'Amount_LB']
	const limit  = types.length;
	types.forEach(function(type) {
		if (type == "Detergent") {
  			value = td;
  		} else if (type == "Softener") {
  			value = ts;
  		} else if (type == "LB") {
  			value = tb;
  		} else if (type == "Amount_Det") {
  			value = ad;
  		} else if (type == "Amount_Soft") {
  			value = as;
  		} else if (type == "Amount_LB") {
  			value = ab;
  		}
  		let data = [value, type];
		let sql = 'UPDATE monthlyDetTotalValue SET '+month+'= ? WHERE Type = ?';
		db.run(sql, data, function(err) {
			if (err) {
    			return console.error(err.message);
  			}
  			//console.log("data has been updated")
  			count++;
  			if (count == limit) {
  				//console.log("its running ")
  				callback(sDM);
  			}
		});
	})
}

function clearDetMonthlytotal() {
	var types = ['Detergent', 'Softener', 'LB','Amount_Det', 'Amount_Soft', 'Amount_LB']
	types.forEach(function(type) {
		let data = [type];
		let sql = 'UPDATE monthlyDetTotalValue SET January = 0, February = 0, March = 0, April = 0, May = 0, June = 0, July = 0, August = 0, September = 0, October = 0, November = 0, December = 0 WHERE Type = ?';
		db.run(sql, data, function(err) {
			if (err) {
    			return console.error(err.message);
  			}
  		});
  	});
}

function clearDetMonthlyAll() {
	var types = ['Detergent', 'Softener', 'LB','Amount_Det', 'Amount_Soft', 'Amount_LB']
	types.forEach(function(type) {
		let data = [type];
		let sql = 'UPDATE monthlyDetTotalAllOutlet SET January = 0, February = 0, March = 0, April = 0, May = 0, June = 0, July = 0, August = 0, September = 0, October = 0, November = 0, December = 0 WHERE Type = ?';
		db.run(sql, data, function(err) {
			if (err) {
    			return console.error(err.message);
  			}
  		});
  	});
}
/// save the det sales unit data of all outlets from sqlite to csv files 

function allDetMonthlyMove(sDY) {
	var types = ["Detergent_Unit", "Softener_Unit", "LB_Unit","Detergent_Sales", "Softener_Sales", "LB_Sales"]
	var count = 0;
	var length = types.length
	var month = moment().subtract(1,'months').format("MMMM")
	//console.log("length " + length)
	db.serialize(function() {
		types.forEach(function(t) {
			let sql7 = 'SELECT Type type, January Jan, February Feb, March Mar, April Apr, May may, June Jun, July Jul, August Aug, September Sept, October Oct, November Nov, December Dec FROM monthlyDetTotalAllOutlet WHERE Type = ? ORDER BY type';
			db.get(sql7, [t], function(err, row) {
				sDY.push(row)
				//console.log(row)
				count++;
				if (count == length) {
					//console.log(sDY)
					if (uploadMode == "Google") {
						exports.save2csv("allDetMonthlyUpdate", sDY, exports.upload2GD, reports_deposit_area)
					} else if (uploadMode == "FTP") {
						exports.save2csv("allDetMonthlyUpdate", sDY, exports.uploadFilesFTP, ftp_det_report)
					}
					if (month == "December") {
						clearDetMonthlyAll();
					}
				}
			})
		})
	})
}

/// save the det sales unit data of this particular outlet from sqlite to csv files 

function detMonthlyMove(sDY) {
	var types = ["Detergent", "Softener", "LB", "Amount_Det", "Amount_Soft", "Amount_LB"]
	var count = 0;
	var length = types.length;
	var month = moment().subtract(1,'months').format("MMMM")
	//console.log("length " + length)
	db.serialize(function() {
		types.forEach(function(t) {
			//console.log(t)
			let sql = 'SELECT Type type, January Jan, February Feb, March Mar, April Apr, May may, June Jun, July Jul, August Aug, September Sept, October Oct, November Nov, December Dec FROM monthlyDetTotalValue WHERE Type = ? ORDER BY type';
			db.get(sql, [t], function(err, row) {
				//console.log(t)
				//console.log(t + " " +row)
				sDY.push(row)
				count++;
				if (count == length) {
					//console.log(sDY)
					if (uploadMode == "Google") {
						exports.save2csv("detMonthlyUpdate", sDY, exports.upload2GD, reports_deposit_area)
					} else if (uploadMode == "FTP") {
						exports.save2csv("detMonthlyUpdate", sDY, exports.uploadFilesFTP, ftp_det_report)
					}
					if (month == "December") {
						clearDetMonthlytotal();
					}
				}
			})
		})
	})
}

///// save the daily data to the up2date database and export those daily data to the csv format 

function saveDaily() {
	var mydate = moment().format("DD/MM/YYYY")
	var thisMonth = moment().format("MMMM");
	const detSum = sumDetSnU+"_"+thisMonth+".csv";
	const salesBt = sumSalesTp+"_"+thisMonth+".csv";
	const salesSum = sumSalesDaily+"_"+thisMonth+".csv";
	const csvPath = "./reports/devices_disconnection"+"_"+thisMonth+".csv";
	const csvName = "devices_disconnection"+"_"+thisMonth+".csv";
	const cFRname = "Manual_CutOff_Report_"+outlet.name+"_"+thisMonth+".csv"
	const ctrlMntrName = "Monitoring_record_"+outlet.name+"_"+thisMonth+".csv";
	const cFRCsvPath = cutOffRpt +"_"+thisMonth+".csv";
	const ctrlMntrPath = ctrlMntrRpt+"_"+thisMonth+".csv";

	if (fs.existsSync(detSum)) {
		//console.log("check")
		removeLast(detSum);
	} 
	if (fs.existsSync(salesBt)) {
		removeLast(salesBt); 
	}
	if (fs.existsSync(salesSum)) {
		removeLast(salesSum);
	}
	setTimeout(function () {
		if (uploadMode == "Google") {
			exports.save2csv("mchSalesbyType", sumSalesByType[mydate], exports.uploadNothing, reports_deposit_area);
		} else if (uploadMode == "FTP") {
			exports.save2csv("mchSalesbyType", sumSalesByType[mydate], exports.uploadNothing, ftp_Coinop_report)
		}
		if (uploadMode == "Google") {
			exports.save2csv("mchSalesbyType", sumSalesByType["Total"], exports.upload2GD, reports_deposit_area);
		} else if (uploadMode == "FTP") {
			exports.save2csv("mchSalesbyType", sumSalesByType["Total"], exports.uploadFilesFTP, ftp_Coinop_report)
		}
	}, 10000)
	setTimeout(function () {
		if (uploadMode == "Google") {
			exports.save2csv("sumDetSalesDaily", sumDetDaily[mydate], exports.uploadNothing, reports_deposit_area);
		} else if (uploadMode == "FTP") {
			exports.save2csv("sumDetSalesDaily", sumDetDaily[mydate], exports.uploadNothing, ftp_det_report)
		}
		if (uploadMode == "Google") {
			exports.save2csv("sumDetSalesDaily", sumDetDaily["Total"], exports.upload2GD, reports_deposit_area);
		} else if (uploadMode == "FTP") {
			exports.save2csv("sumDetSalesDaily", sumDetDaily["Total"], exports.uploadFilesFTP, ftp_det_report)
		}
	}, 15000)
	setTimeout(function () {
		if (uploadMode == "Google") {
			exports.save2csv("mchSalesSumDaily", sumSalesRecord[mydate], exports.uploadNothing, reports_deposit_area);
		} else if (uploadMode == "FTP") {
			exports.save2csv("mchSalesSumDaily", sumSalesRecord[mydate], exports.uploadNothing, ftp_Coinop_report)
		}
		if (uploadMode == "Google") {
			exports.save2csv("mchSalesSumDaily", sumSalesRecord["Total"], exports.upload2GD, reports_deposit_area);
		} else if (uploadMode == "FTP") {
			exports.save2csv("mchSalesSumDaily", sumSalesRecord["Total"], exports.uploadFilesFTP, ftp_Coinop_report)
		}
	}, 20000)

	setTimeout(function () {
		if (fs.existsSync(csvPath)) {	
			if (uploadMode == "Google") {
				exports.upload2GD(csvPath, csvName, reports_deposit_area)
			} else if (uploadMode == "FTP") {
				exports.uploadFilesFTP(csvPath, csvName, ftp_log_report)
			}
		} else {
			var print = outlet.name + " Devices Disconnection Log"
			fs.writeFile(csvPath, print, 'utf8', function(err) {
				if (err) throw err;
				if (uploadMode == "Google") {
					exports.upload2GD(csvPath, csvName, reports_deposit_area)
				} else if (uploadMode == "FTP") {
					exports.uploadFilesFTP(csvPath, csvName, ftp_log_report)
				}
			//console.log("The new csv file has been created")
			});
		}
	}, 2000);

	if (!fs.existsSync(cFRCsvPath)) {
		var data = {}
		setTimeout(function () {
			if (uploadMode == "Google") {
				exports.save2csv("manualCutOff", data, exports.upload2GD, reports_deposit_area);
			} else if (uploadMode == "FTP") {
				exports.save2csv("manualCutOff", data, exports.uploadFilesFTP, ftp_log_report)
			}	
		}, 5000);
	} else {
		setTimeout(function () {
			if (uploadMode == "Google") {
				exports.upload2GD(cFRCsvPath, cFRname, reports_deposit_area)
			} else if (uploadMode == "FTP") {
				exports.uploadFilesFTP(cFRCsvPath, cFRname, ftp_log_report)
			}	
		}, 5000);
	}
	if (!fs.existsSync(ctrlMntrPath)) {
		var data = {}
		setTimeout(function () {
			if (uploadMode == "Google") {
				exports.save2csv("controlMon", data, exports.upload2GD, reports_deposit_area);
			} else if (uploadMode == "FTP") {
				exports.save2csv("controlMon", data, exports.uploadFilesFTP, ftp_log_report)
			}	
		}, 5000);
	} else {
		setTimeout(function () {
			if (uploadMode == "Google") {
				exports.upload2GD(ctrlMntrPath, ctrlMntrName, reports_deposit_area)
			} else if (uploadMode == "FTP") {
				exports.uploadFilesFTP(ctrlMntrPath, ctrlMntrName, ftp_log_report)
			}	
		}, 5000);
	}
};

// Load up the previous up2date data from the sqlite database 

function initU2Ddata (vi, callback, sru2d) {
	var counter = 0;
	var itemlength = Object.keys(vi).length;
	var mydate = moment().format("DD/MM/YYYY");
	var thisMonth = moment().format("MMMM");
	var cutTime = moment('23:30:00', 'h:mm:ss');
	db.serialize(function() {
		Object.keys(vi).forEach(function(key) {
			if (!sru2d[key]) {
				sru2d[key] = {}
			}
			let sql = 'SELECT Total_Run tr, Wechat_received wr, Epay_received er, Coin_received cr, Manual_payment mp, No_Cold_Run ncr, No_Warm_Run nwr, No_Hot_Run nhr, No_Other_Run nor, Actual_Total_Run_Time trt, Actual_Total_Run_Time_Top trtt, Actual_Total_Run_Time_Bot trtb, Expected_Total_Run_Time etrt, totalDet td, totalSoftnr ts, totalBeg tb FROM uptoDateValue WHERE Machine_Code = ?';
			db.get(sql, [key], function(err, row) {
				if (err) {
	    			return console.error(err.message);
	  			} 
	  			sru2d[key].machineCode = key;
	  			sru2d[key].Title = vi[key].machineName;
	  			sru2d[key].Total_Run = row.tr;
				sru2d[key].Wechat_received = row.wr;
				sru2d[key].Epay_received = row.er;
				sru2d[key].Coin_received = row.cr;
				sru2d[key].Manual_payment = row.mp;
				sru2d[key].No_Cold_Run = row.ncr;
				sru2d[key].No_Warm_Run = row.nwr;
				sru2d[key].No_Hot_Run = row.nhr;
				sru2d[key].No_Other_Run = row.nor;
				sru2d[key].Actual_Total_Run_Time = row.trt;
				sru2d[key].Actual_Total_Run_Time_Top = row.trtt;
				sru2d[key].Actual_Total_Run_Time_Bot = row.trtb;
				sru2d[key].Expected_Total_Run_Time = row.etrt;
				sru2d[key].Total_Det = row.td;
				sru2d[key].Total_Soft = row.ts;
				sru2d[key].Total_LB = row.tb;
				sru2d[key].Date = mydate;
				counter++
				if (moment().isAfter(cutTime)) {
					if (moment().add(1,'days').format("MMMM") != thisMonth ) {
						let sql2 = 'UPDATE uptoDateValue SET Total_Run = 0, Wechat_received = 0, Epay_received = 0, Coin_received = 0, Manual_payment = 0, No_Cold_Run = 0, No_Warm_Run = 0, No_Hot_Run = 0, No_Other_Run = 0, Actual_Total_Run_Time = 0, Actual_Total_Run_Time_Top = 0, Actual_Total_Run_Time_Bot = 0, Expected_Total_Run_Time = 0, totalDet = 0, totalSoftnr = 0, totalBeg = 0 WHERE Machine_Code = ?';
						let data2 = [key];
						db.run(sql2, data2, function(err) {
							if (err) {
	    						return console.error(err.message);
	  						}
	  						//console.log("up2date data has been updated")
						});
					}
				}
				if (counter == itemlength) {
					callback(vi, sru2d)
				}
			})
		})
	})
}


/// update the daily data and also the up2date data

function updateDailyData (VI, callback) {
	var mydate = moment().format("DD/MM/YYYY")
	var mymonth = moment().format("MMMM")
	var myyear = moment().format("YYYY")
	var totalD=0, totalS = 0, totalB = 0, totalT = 0;
	var counter = 0;
	////console.log(sumru2d)
	const length = Object.keys(VI).length;
	db.serialize(function() {
		let sql = 'SELECT * FROM pricing WHERE outlet = ?';
		db.all(sql, [outlet.name], function(err, row) {
			if (err) {
	    		return console.error(err.message);
	  		}
	  		pricing_data = Object.assign({}, row[0]);
	  		//console.log(pricing_data)
			Object.keys(VI).forEach(function(key) {
				if (VI[key].typeOfMachine.match(/dryer/g)) {
					updateTotalAll(VI, key, VI[key].totalCoin, VI[key].totalWechat, VI[key].totalEpay, VI[key].totalManual, 0, 0, 0, "NA")
					console.log(pricing_data)
					var kgPattern = /[0-9]+kg/g
					//console.log(kgPattern)
					var kg = VI[key].typeOfMachine.match(kgPattern)
					//console.log(kg)
					var dryPrice = "dry"+kg 
					//console.log(dryPrice)
					var oneRunTime = pricing_data[dryPrice]
					//console.log("RunTime :"+ VI[key].machineName+" "+oneRunTime)
					var expectedRunTime =  VI[key].totalPaid * oneRunTime
					if (VI[key].typeOfMachine.match(/dex_dryer_double/g)) {
						sumExecuteRecord(key, VI[key].machineName, VI[key].totalCoin, VI[key].totalWechat, VI[key].totalEpay, VI[key].totalManual, VI[key].totalRun, 0, 0, 0, 0, 0, VI[key].totalTime.upper, VI[key].totalTime.lower, expectedRunTime, mydate)
						VI[key].totalRun = 0;
						exports.dataDailyRestart(key, "totalRun", 0)
						VI[key].totalTime.upper = VI[key].totalTime.lower = 0;
						exports.dataDailyRestart(key, "totalTimeTop", 0); exports.dataDailyRestart(key, "totalTimeBot", 0); 
						//console.log(sumRunRecord[key])	
					} else {
						sumExecuteRecord(key, VI[key].machineName, VI[key].totalCoin, VI[key].totalWechat, VI[key].totalEpay, VI[key].totalManual, VI[key].totalRun, 0, 0, 0, 0, VI[key].totalTime, 0, 0, expectedRunTime, mydate)
						//console.log(sumRunRecord[key])
				       	VI[key].totalRun = VI[key].totalTime = 0;
				       	exports.dataDailyRestart(key, "totalRun", 0)
				        exports.dataDailyRestart(key, "totalTime", 0)
					}
					var pattern = /D[0-9]+kg/g
					var mchKg = VI[key].typeOfMachine.match(pattern)
					var mchKgC = mchKg + "C"
					var mchKgW = mchKg + "W"
					var mchKgE = mchKg + "E"
					var mchKgT = mchKg + "T"
					if(!sumAmountByType[mchKgC]) {
						sumAmountByType[mchKgC] = 0
					}
					if(!sumAmountByType[mchKgE]) {
						sumAmountByType[mchKgE] = 0
					}
					if (!sumAmountByType[mchKgW]) {
						sumAmountByType[mchKgW] = 0
					}
					if (!sumAmountByType[mchKgT]) {
						sumAmountByType[mchKgT] = 0
					}
					sumAmountByType[mchKgC] = sumAmountByType[mchKgC] + VI[key].totalCoin;
					sumAmountByType[mchKgW] = sumAmountByType[mchKgW] + VI[key].totalWechat;
					sumAmountByType[mchKgE] = sumAmountByType[mchKgE] + VI[key].totalEpay;
					sumAmountByType[mchKgT] = sumAmountByType[mchKgT] + VI[key].totalPaid;
					salesSummarize(key, VI[key].totalPaid, VI[key].totalWechat, VI[key].totalEpay, VI[key].totalCoin,mydate)
					VI[key].totalManual = VI[key].totalPaid = VI[key].totalWechat = VI[key].totalEpay = VI[key].totalCoin = 0;
					//mchNo, tw, te, tc, tp, tm
					exports.dataDailyRestartDryer(key, 0, 0, 0, 0, 0)
				} else if (VI[key].typeOfMachine.match(/Washer/g)) {
					updateTotalAll(VI, key, VI[key].totalCoin, VI[key].totalWechat, VI[key].totalEpay, VI[key].totalManual, 0, 0, 0, "NA")
					var expectedRunTime = VI[key].totalRun * VI[key].oneRunTime
					sumExecuteRecord(key, VI[key].machineName, VI[key].totalCoin, VI[key].totalWechat, VI[key].totalEpay, VI[key].totalManual, VI[key].totalRun, VI[key].coldRun , VI[key].warmRun, VI[key].hotRun, VI[key].otherRun, VI[key].totalTime,0, 0,  expectedRunTime, mydate)
					//console.log(sumRunRecord[key])
					var pattern = /W[0-9]+kg/g
					var mchKg = VI[key].typeOfMachine.match(pattern)
					var mchKgC = mchKg + "C"
					var mchKgW = mchKg + "W"
					var mchKgE = mchKg + "E"
					var mchKgT = mchKg + "T"
					if(!sumAmountByType[mchKgC]) {
						sumAmountByType[mchKgC] = 0
					}
					if (!sumAmountByType[mchKgW]) {
						sumAmountByType[mchKgW] = 0
					}
					if (!sumAmountByType[mchKgE]) {
						sumAmountByType[mchKgE] = 0
					}
					if (!sumAmountByType[mchKgT]) {
						sumAmountByType[mchKgT] = 0
					}
					sumAmountByType[mchKgC] = sumAmountByType[mchKgC] + VI[key].totalCoin;
					sumAmountByType[mchKgW] = sumAmountByType[mchKgW] + VI[key].totalWechat;
					sumAmountByType[mchKgE] = sumAmountByType[mchKgE] + VI[key].totalEpay;
					sumAmountByType[mchKgT] = sumAmountByType[mchKgT] + VI[key].totalPaid;
					salesSummarize(key, VI[key].totalPaid, VI[key].totalWechat, VI[key].totalEpay, VI[key].totalCoin,mydate)
					VI[key].totalPaid = VI[key].totalManual = VI[key].totalWechat = VI[key].totalEpay = VI[key].totalCoin = VI[key].totalRun = VI[key].totalTime = VI[key].coldRun = VI[key].warmRun = VI[key].hotRun = VI[key].otherRun = 0;
					// reset all the total values for washer
					//mchNo, tw, te, tc, tp, tm, tr, tt, thr, tcr, twr, tor
					exports.dataDailyRestartWasher(key, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
				} else if (VI[key].typeOfMachine.match(/detergent/g)) {
					updateTotalAll(VI, key, VI[key].totalCoin, VI[key].totalWechat, VI[key].totalEpay, VI[key].totalManual, VI[key].detergent, VI[key].softnr, VI[key].beg, "NA")
					if(!sumAmountByType.DetC) {
						sumAmountByType.DetC = 0
					}
					if (!sumAmountByType.DetW) {
						sumAmountByType.DetW = 0
					}
					if (!sumAmountByType.DetE) {
						sumAmountByType.DetE = 0
					}
					if (!sumAmountByType.DetT) {
						sumAmountByType.DetT = 0
					}
			        sumAmountByType.DetC = sumAmountByType.DetC + VI[key].totalCoin;
			        sumAmountByType.DetW = sumAmountByType.DetW + VI[key].totalWechat;
			        sumAmountByType.DetE = sumAmountByType.DetE + VI[key].totalEpay;
			        sumAmountByType.DetT = sumAmountByType.DetT + VI[key].totalPaid;
			        var totalDrop = VI[key].detergent + VI[key].softnr + VI[key].beg;
			        detSumDaily(VI, key, VI[key].totalPaid, VI[key].totalWechat, VI[key].totalEpay, VI[key].totalCoin, VI[key].totalManual, mydate, VI[key].detergent, VI[key].softnr, VI[key].beg, totalDrop)
			        totalD = totalD + VI[key].detergent;
			        totalB = totalB + VI[key].beg;
			        totalS = totalS + VI[key].softnr;
			        salesSummarize(key, VI[key].totalPaid, VI[key].totalWechat, VI[key].totalEpay, VI[key].totalCoin,mydate)
			        VI[key].totalPaid = VI[key].totalManual = VI[key].totalWechat = VI[key].totalEpay = VI[key].totalCoin = VI[key].totalRun = VI[key].detergent = VI[key].softnr = VI[key].beg = 0;
					// reset all the total values for vending
					//(mchNo, tw, tc, tp, tm, det, soft, lb, tr)
					exports.dataDailyRestartVending(key, 0, 0, 0, 0, 0, 0, 0, 0)
				}
				counter++
				if (counter == length) {
					//console.log(sumAmountByType)
					//console.log("d= "+totalD+" s= "+totalS+" b= "+totalB)
					detMonthlysave("Detergent",totalD, "Amount_Det");
				    detMonthlysave("Softener",totalS, "Amount_Soft");
				    detMonthlysave("LB",totalB, "Amount_LB");
				    const sumMchFname = "DailySum_MachineRunStatus_"+outlet.name+"_"+mymonth+".csv"
					const sumMchPath = sumMachineRun+"_"+mymonth+".csv";
					//console.log(sumSalesRecord[mydate])
					updateTotalAll(VI,"Total", sumSalesRecord[mydate].gtc, sumSalesRecord[mydate].gtw, sumSalesRecord[mydate].gte, 0, 0, 0, 0, "All")
					updateTotalAll(VI,"Total", sumDetDaily[mydate]["totalC"], sumDetDaily[mydate]["totalW"], sumDetDaily[mydate]["totalE"], sumDetDaily[mydate]["totalM"], sumDetDaily[mydate]["totalD"], sumDetDaily[mydate]["totalS"], sumDetDaily[mydate]["totalB"], "Det")
					//detSumDailyTotal(VI, "Total");
					//salesSummarizeTotal(VI, "Total")
					salesSumType(sumAmountByType, mydate)
					if(uploadMode == "Google") {
						setTimeout(function () {
							exports.upload2GD(sumMchPath, sumMchFname, reports_deposit_area)
						}, 2000);
					} else if (uploadMode == "FTP") {
						setTimeout(function () {
							exports.uploadFilesFTP(sumMchPath, sumMchFname, ftp_log_report)
						}, 2000);
					}
					setTimeout(function() {
						Object.keys(sumAmountByType).forEach(function(key) {
							if (key != "date") {
								sumAmountByType[key] = 0
							}
						})
					}, 3000);
				}
			});
		});
	});
	callback();
}

function updateTotalAllByType (key, type, value) {
	let tmptype = type+"_tmp"
	var currentMonth = moment().format("MMMM")
	db.serialize(function() {
		let sql = 'SELECT '+type+' '+tmptype+' FROM totalValueAllByType WHERE Type = ?';
		db.get(sql, [key], function(err, row) {
			//console.log("the data is "+row[tmpkey])
			var total = row[tmptype] + value
			if (err) {
	    		return console.error(err.message);
	  		}
	  		if (moment().add(1,'days').format("MMMM") != currentMonth ) {
	  			total = 0;
	  		}
	  		let sql = 'UPDATE totalValueAllByType SET '+type+'= ? WHERE Type = ?';
			let data = [total, key];
			db.run(sql, data, function(err) {
				if (err) {
	    			return console.error(err.message);
	  			}
	  			//console.log("up2date data has been updated")
			});
		})
	})
}

function updateTotalAll (myVI, mchCode, Cvalue, Wvalue, Evalue, Mvalue, Dvalue, Svalue, Bvalue, allODet) {
	db.serialize(function() {
		var currentMonth = moment().format("MMMM")
		if (mchCode == "Total") {
			if (allODet == "Det") {
				let sql = 'SELECT Wechat_received wr, Epay_received er, Coin_received cr, Manual_payment mp, total_det td, total_soft ts, total_lb tb FROM detTotalValueAll WHERE machineCode = ?';
				db.get(sql, [mchCode], function(err, row) {
					if (err) {
			    		return console.error(err.message);
			  		}
					//console.log("the data is "+row[tmpkey])
					var totalW = row.wr + Wvalue;
					var totalE = row.er + Evalue;
					var totalC = row.cr + Cvalue;
					var totalM = row.mp + Mvalue;
					var totalD = row.td + Dvalue;
					var totalS = row.ts + Svalue;
					var totalB = row.tb + Bvalue;
					var totalT = totalD + totalS + totalB;
					var totalP = totalW + totalC + totalE;
					detSumDailyTotal(myVI, mchCode, "Wechat_received", totalW);
					detSumDailyTotal(myVI, mchCode, "Epay_received", totalE);
					detSumDailyTotal(myVI, mchCode, "Coin_received", totalC);
					detSumDailyTotal(myVI, mchCode, "TotalP", totalP);
					detSumDailyTotal(myVI, mchCode, "Manual_payment", totalM);
					detSumDailyTotal(myVI, mchCode, "total_det", totalD);
					detSumDailyTotal(myVI, mchCode, "total_soft", totalS);
					detSumDailyTotal(myVI, mchCode, "total_lb", totalB);
					detSumDailyTotal(myVI, mchCode, "TotalT", totalT);
					if (moment().add(1,'days').format("MMMM") != currentMonth ) {
						totalW = totalE = totalC = totalM = totalD = totalS = totalB = totalT = totalP = 0
					}
					let sql0 = 'UPDATE detTotalValueAll SET Epay_received = ? WHERE machineCode = ?';
					let data0 = [totalE, mchCode];
					db.run(sql0, data0, function(err) {
						if (err) {
			    			return console.error(err.message);
			  			}
			  			//console.log("up2date data has been updated")
					});
			  		let sql1 = 'UPDATE detTotalValueAll SET Wechat_received = ? WHERE machineCode = ?';
					let data1 = [totalW, mchCode];
					db.run(sql1, data1, function(err) {
						if (err) {
			    			return console.error(err.message);
			  			}
			  			//console.log("up2date data has been updated")
					});
					let sql2 = 'UPDATE detTotalValueAll SET Coin_received = ? WHERE machineCode = ?';
					let data2 = [totalC, mchCode];
					db.run(sql2, data2, function(err) {
						if (err) {
			    			return console.error(err.message);
			  			}
			  			//console.log("up2date data has been updated")
					});
					let sql3 = 'UPDATE detTotalValueAll SET Manual_payment = ? WHERE machineCode = ?';
					let data3 = [totalM, mchCode];
					db.run(sql3, data3, function(err) {
						if (err) {
			    			return console.error(err.message);
			  			}
			  			//console.log("up2date data has been updated")
					});
					let sql4 = 'UPDATE detTotalValueAll SET total_det = ? WHERE machineCode = ?';
					let data4 = [totalD, mchCode];
					db.run(sql4, data4, function(err) {
						if (err) {
			    			return console.error(err.message);
			  			}
			  			//console.log("up2date data has been updated")
					});
					let sql5 = 'UPDATE detTotalValueAll SET total_soft = ? WHERE machineCode = ?';
					let data5 = [totalS, mchCode];
					db.run(sql5, data5, function(err) {
						if (err) {
			    			return console.error(err.message);
			  			}
			  			//console.log("up2date data has been updated")
					});
					let sql6 = 'UPDATE detTotalValueAll SET total_lb = ? WHERE machineCode = ?';
					let data6 = [totalB, mchCode];
					db.run(sql6, data6, function(err) {
						if (err) {
			    			return console.error(err.message);
			  			}
			  			//console.log("up2date data has been updated")
					});
				})
			} else if (allODet == "All") {
				let sql = 'SELECT Wechat_received wr, Epay_received er, Coin_received cr FROM totalValueAll WHERE machineCode = ?';
				db.get(sql, [mchCode], function(err, row) {
					//console.log("the data is "+row[tmpkey])
					var totalW = row.wr + Wvalue;
					var totalE = row.er + Evalue;
					var totalC = row.cr + Cvalue;
					var totalP = totalW + totalC + totalE;
					salesSummarizeTotal(myVI, mchCode, "Wechat_received", totalW);
					salesSummarizeTotal(myVI, mchCode, "Epay_received", totalE);
					salesSummarizeTotal(myVI, mchCode, "Coin_received", totalC);
					salesSummarizeTotal(myVI, mchCode, "TotalP", totalP);
					if (err) {
			    		return console.error(err.message);
			  		}
			  		if (moment().add(1,'days').format("MMMM") != currentMonth ) {
			  			totalW = totalE = totalC = totalP = 0;
			  		}
			  		let sql0 = 'UPDATE totalValueAll SET Epay_received = ? WHERE machineCode = ?';
					let data0 = [totalE, mchCode];
					db.run(sql0, data0, function(err) {
						if (err) {
			    			return console.error(err.message);
			  			}
			  			//console.log("up2date data has been updated")
					});
			  		let sql1 = 'UPDATE totalValueAll SET Wechat_received = ? WHERE machineCode = ?';
					let data1 = [totalW, mchCode];
					db.run(sql1, data1, function(err) {
						if (err) {
			    			return console.error(err.message);
			  			}
			  			//console.log("up2date data has been updated")
					});
					let sql2 = 'UPDATE totalValueAll SET Coin_received = ? WHERE machineCode = ?';
					let data2 = [totalC, mchCode];
					db.run(sql2, data2, function(err) {
						if (err) {
			    			return console.error(err.message);
			  			}
			  			//console.log("up2date data has been updated")
					});

				})
			}
		} else {
			if (myVI[mchCode].typeOfMachine.match(/detergent/g)) {
				let sql = 'SELECT Wechat_received wr, Epay_received er, Coin_received cr, Manual_payment mp, total_det td, total_soft ts, total_lb tb FROM detTotalValueAll WHERE machineCode = ?';
				db.get(sql, [mchCode], function(err, row) {
					if (err) {
			    		return console.error(err.message);
			  		}
					//console.log("the data is "+row[tmpkey])
					var totalW = row.wr + Wvalue;
					var totalE = row.er + Evalue;
					var totalC = row.cr + Cvalue;
					var totalM = row.mp + Mvalue;
					var totalD = row.td + Dvalue;
					var totalS = row.ts + Svalue;
					var totalB = row.tb + Bvalue;
					var totalT = totalD + totalS + totalB;
					var totalP = totalW + totalC + totalE;
					salesSummarizeTotal(myVI, mchCode, "Wechat_received", totalW);
					salesSummarizeTotal(myVI, mchCode, "Epay_received", totalE);
					salesSummarizeTotal(myVI, mchCode, "Coin_received", totalC);
					salesSummarizeTotal(myVI, mchCode, "TotalP", totalP);
					detSumDailyTotal(myVI, mchCode, "Wechat_received", totalW);
					detSumDailyTotal(myVI, mchCode, "Epay_received", totalE);
					detSumDailyTotal(myVI, mchCode, "Coin_received", totalC);
					detSumDailyTotal(myVI, mchCode, "TotalP", totalP);
					detSumDailyTotal(myVI, mchCode, "Manual_payment", totalM);
					detSumDailyTotal(myVI, mchCode, "total_det", totalD);
					detSumDailyTotal(myVI, mchCode, "total_soft", totalS);
					detSumDailyTotal(myVI, mchCode, "total_lb", totalB);
					detSumDailyTotal(myVI, mchCode, "TotalT", totalT);
					if (moment().add(1,'days').format("MMMM") != currentMonth ) {
						totalW  = totalE = totalC = totalM = totalD = totalS = totalB = totalT = totalP = 0
					}
					let sql0 = 'UPDATE detTotalValueAll SET Epay_received = ? WHERE machineCode = ?';
					let data0 = [totalE, mchCode];
					db.run(sql0, data0, function(err) {
						if (err) {
			    			return console.error(err.message);
			  			}
			  			//console.log("up2date data has been updated")
					});
			  		let sql1 = 'UPDATE detTotalValueAll SET Wechat_received = ? WHERE machineCode = ?';
					let data1 = [totalW, mchCode];
					db.run(sql1, data1, function(err) {
						if (err) {
			    			return console.error(err.message);
			  			}
			  			//console.log("up2date data has been updated")
					});
					let sql2 = 'UPDATE detTotalValueAll SET Coin_received = ? WHERE machineCode = ?';
					let data2 = [totalC, mchCode];
					db.run(sql2, data2, function(err) {
						if (err) {
			    			return console.error(err.message);
			  			}
			  			//console.log("up2date data has been updated")
					});
					let sql3 = 'UPDATE detTotalValueAll SET Manual_payment = ? WHERE machineCode = ?';
					let data3 = [totalM, mchCode];
					db.run(sql3, data3, function(err) {
						if (err) {
			    			return console.error(err.message);
			  			}
			  			//console.log("up2date data has been updated")
					});
					let sql4 = 'UPDATE detTotalValueAll SET total_det = ? WHERE machineCode = ?';
					let data4 = [totalD, mchCode];
					db.run(sql4, data4, function(err) {
						if (err) {
			    			return console.error(err.message);
			  			}
			  			//console.log("up2date data has been updated")
					});
					let sql5 = 'UPDATE detTotalValueAll SET total_soft = ? WHERE machineCode = ?';
					let data5 = [totalS, mchCode];
					db.run(sql5, data5, function(err) {
						if (err) {
			    			return console.error(err.message);
			  			}
			  			//console.log("up2date data has been updated")
					});
					let sql6 = 'UPDATE detTotalValueAll SET total_lb = ? WHERE machineCode = ?';
					let data6 = [totalB, mchCode];
					db.run(sql6, data6, function(err) {
						if (err) {
			    			return console.error(err.message);
			  			}
			  			//console.log("up2date data has been updated")
					});
				})
			} else {
				let sql = 'SELECT Wechat_received wr, Epay_received er, Coin_received cr FROM totalValueAll WHERE machineCode = ?';
				db.get(sql, [mchCode], function(err, row) {
					//console.log("the data is "+row[tmpkey])
					var totalW = row.wr + Wvalue;
					var totalE = row.er + Evalue;
					var totalC = row.cr + Cvalue;
					var totalP = totalW + totalC + totalE;
					salesSummarizeTotal(myVI, mchCode, "Wechat_received", totalW);
					salesSummarizeTotal(myVI, mchCode, "Epay_received", totalE);
					salesSummarizeTotal(myVI, mchCode, "Coin_received", totalC);
					salesSummarizeTotal(myVI, mchCode, "TotalP", totalP);
					if (err) {
			    		return console.error(err.message);
			  		}
			  		if (moment().add(1,'days').format("MMMM") != currentMonth ) {
			  			totalW = totalE = totalC = totalP = 0;
			  		}
			  		let sql0 = 'UPDATE totalValueAll SET Epay_received = ? WHERE machineCode = ?';
					let data0 = [totalE, mchCode];
					db.run(sql0, data0, function(err) {
						if (err) {
			    			return console.error(err.message);
			  			}
			  			//console.log("up2date data has been updated")
					});

			  		let sql1 = 'UPDATE totalValueAll SET Wechat_received = ? WHERE machineCode = ?';
					let data1 = [totalW, mchCode];
					db.run(sql1, data1, function(err) {
						if (err) {
			    			return console.error(err.message);
			  			}
			  			//console.log("up2date data has been updated")
					});
					let sql2 = 'UPDATE totalValueAll SET Coin_received = ? WHERE machineCode = ?';
					let data2 = [totalC, mchCode];
					db.run(sql2, data2, function(err) {
						if (err) {
			    			return console.error(err.message);
			  			}
			  			//console.log("up2date data has been updated")
					});

				})
			}
		}
	})
}

function uploadNothing (VI, test) {

}

function updateUp2Date (VI, sumru2d) {
	var counter = 0;
	var mymonth = moment().format("MMMM")
	const length = Object.keys(VI).length;
	var sumRunU2D_tmp = []
	Object.keys(sumru2d).forEach(function(key) {
		sumRunU2D_tmp.push(sumru2d[key]);
		counter++
		if (counter == length) {
			setTimeout(function () {
				if (uploadMode == "Google") {
					exports.save2csv("sumRunUp2dat", sumRunU2D_tmp, exports.upload2GD, reports_deposit_area);
				} else if (uploadMode == "FTP") {
					exports.save2csv("sumRunUp2dat", sumRunU2D_tmp, exports.uploadFilesFTP, ftp_log_report)
				}
			}, 3000)
		}
	});

	const epayFname = "Epayment_Trans_"+outlet.name+"_"+mymonth+".csv";
	const epayCsvPath = ePaymentCsv+"_"+mymonth+".csv";
	const mpayFname = "Manual_Payment_"+outlet.name+"_"+mymonth+".csv";
	const mpayCsvPath = manualPayCsv+"_"+mymonth+".csv";
	const chkMFname = "MachineRunStatus_"+outlet.name+"_"+mymonth+".csv";
	const chkCsvPath = chkMachineRun+"_"+mymonth+".csv";
	
	if (!fs.existsSync(epayCsvPath)) {
		var data = {}
		setTimeout(function () {
			if (uploadMode == "Google") {
				exports.save2csv("ePayment", data, exports.upload2GD, reports_deposit_area);
			} else if (uploadMode == "FTP") {
				exports.save2csv("ePayment", data, exports.uploadFilesFTP, ftp_log_report)
			}	
		}, 10000);
	} else {
		setTimeout(function () {
			if (uploadMode == "Google") {
				exports.upload2GD(epayCsvPath, epayFname, reports_deposit_area)
			} else if (uploadMode == "FTP") {
				exports.uploadFilesFTP(epayCsvPath, epayFname, ftp_log_report)
			}
		}, 10000);
	}
	if (!fs.existsSync(mpayCsvPath)) {
		var data = {}
		setTimeout(function () {
			if (uploadMode == "Google") {
				exports.save2csv("manualPay", data, exports.upload2GD, reports_deposit_area);
			} else if (uploadMode == "FTP") {
				exports.save2csv("manualPay", data, exports.uploadFilesFTP, ftp_log_report)
			}
		}, 5000);
	} else {
		setTimeout(function () {
			if (uploadMode == "Google") {
				exports.upload2GD(mpayCsvPath, mpayFname, reports_deposit_area)
			} else if (uploadMode == "FTP") {
				exports.uploadFilesFTP(mpayCsvPath, mpayFname, ftp_log_report)
			}
		}, 5000);
	}
	if (!fs.existsSync(chkCsvPath)) {
		var data = {}
		setTimeout(function () {
			if (uploadMode == "Google") {
				exports.save2csv("chkMachineRun", data, exports.upload2GD, reports_deposit_area);
			} else if (uploadMode == "FTP") {
				exports.save2csv("chkMachineRun", data, exports.uploadFilesFTP, ftp_log_report)
			}
		}, 25000);
	} else {
		setTimeout(function () {
			if (uploadMode == "Google") {
				exports.upload2GD(chkCsvPath, chkMFname, reports_deposit_area)
			} else if (uploadMode == "FTP") {
				exports.uploadFilesFTP(chkCsvPath, chkMFname, ftp_log_report)
			}
		}, 25000);
	}
}

////////////////////////////////////////////////////
//// Saving all the data into the JSON objects /////
////////////////////////////////////////////////////

module.exports.createEntry = function (mchCode, mtd, transId, title, amount, payeeId, date, time, status, remark, mTR){
	mTR[transId] = {};
	mTR[transId].method = mtd;
	mTR[transId].transId = transId;
	mTR[transId].machineCode = mchCode;
	mTR[transId].title = title;
	mTR[transId].amount = amount;
	mTR[transId].payeeId = payeeId;
	mTR[transId].time = time;
	mTR[transId].date = date;
	mTR[transId].status = status;
	mTR[transId].remark = remark;
}
//['title', 'time', 'status', 'remark', 'machineCode','User']
module.exports.createMonReport = function (mchCode, title, sts, time, remark, user,cMR){
	cMR[mchCode] = {};
	cMR[mchCode].title = title;
	cMR[mchCode].time = time;
	cMR[mchCode].status = sts;
	cMR[mchCode].remark = remark;
	cMR[mchCode].User = user;
}

module.exports.mchRunRecord = function (myRunR, mchCode, name, side, noOfRun, runTime, coinPaid, wechatPaid, epayPaid, manualPaid, det, softnr, lb, status, date, startTime, endTime){
	myRunR[mchCode] = {};
	myRunR[mchCode][noOfRun] = {};
	myRunR[mchCode][noOfRun].no = noOfRun;
	myRunR[mchCode][noOfRun].machine = mchCode;
	myRunR[mchCode][noOfRun].name = name;
	myRunR[mchCode][noOfRun].side = side;
	myRunR[mchCode][noOfRun].runTime = runTime;
	myRunR[mchCode][noOfRun].Wechat_received = wechatPaid;
	myRunR[mchCode][noOfRun].Epay_received = epayPaid;
	myRunR[mchCode][noOfRun].Coin_received = coinPaid;
	myRunR[mchCode][noOfRun].Manual_payment  = manualPaid;
	myRunR[mchCode][noOfRun].Detergent = det;
	myRunR[mchCode][noOfRun].Softener  = softnr;
	myRunR[mchCode][noOfRun].LB = lb;
	myRunR[mchCode][noOfRun].status = status;
	myRunR[mchCode][noOfRun].date = date;
	myRunR[mchCode][noOfRun].startTime = startTime;
	myRunR[mchCode][noOfRun].endTime = endTime;
}
//'Groups', StartTime', 'EndTime', 'Coin_Collected', 'Actual_Coin_Counted', 'Detergent_Unit_Received', 'Detergent_Unit_Counted', 'Softener_Unit_Received', 'Softener_Unit_Counted', 'Beg_Unit_Received', 'Beg_Unit_Counted
module.exports.cutOffReportRecord = function (cutOffR, date, group, tc, cc, td, cd, ts, cs, tb, cb, st, et, cfby, smby){
	cutOffR[group] = {};
	cutOffR[group][date] = {};
	cutOffR[group][date].Machines = group;
	cutOffR[group][date].Coin_Collected = tc;
	cutOffR[group][date].Actual_Coin_Counted = cc;
	cutOffR[group][date].Detergent_Unit_Received = td;
	cutOffR[group][date].Detergent_Unit_Counted = cd;
	cutOffR[group][date].Softener_Unit_Received = ts;
	cutOffR[group][date].Softener_Unit_Counted = cs;
	cutOffR[group][date].Beg_Unit_Received = tb;
	cutOffR[group][date].Beg_Unit_Counted = cb;
	cutOffR[group][date].Last_CutOff_Time = st;
	cutOffR[group][date].Current_CutOff_Time = et;
	cutOffR[group][date].CutOff_by = cfby;
	cutOffR[group][date].Submit_by = smby;
}

function sumExecuteRecord (mchCode, title, totalCoin, totalWechat, totalEpay, totalManual, totalRun, noColdRun, noWarmRun, noHotRun, noOtherRun, actualTotalRunTime, actualTotalRunTimeTop, actualTotalRunTimeBot, expectedTotalRunTime, myDate) {
	sumRunRecord[mchCode] = {};
	sumRunRecord[mchCode].Title = title;
	sumRunRecord[mchCode].TotalCoin = totalCoin;
	sumRunRecord[mchCode].TotalWechat = totalWechat;
	sumRunRecord[mchCode].TotalEpay = totalEpay;
	sumRunRecord[mchCode].TotalManual = totalManual;
	sumRunRecord[mchCode].TotalRun = totalRun;
	sumRunRecord[mchCode].NoColdRun = noColdRun;
	sumRunRecord[mchCode].NoWarmRun = noWarmRun;
	sumRunRecord[mchCode].NoHotRun = noHotRun;
	sumRunRecord[mchCode].NoOtherRun = noOtherRun;
	sumRunRecord[mchCode].ActualTotalRunTime = actualTotalRunTime;
	sumRunRecord[mchCode].ActualTotalRunTimeTop = actualTotalRunTimeTop;
	sumRunRecord[mchCode].ActualTotalRunTimeBot = actualTotalRunTimeBot;
	sumRunRecord[mchCode].ExpectedTotalRunTime = expectedTotalRunTime;
	sumRunRecord[mchCode].myDate = myDate;
	/// just append to the csv files only, no uploading to the cloud 
	if (uploadMode == "Google") {
		exports.save2csv("machineRunStatus", sumRunRecord[mchCode], exports.uploadNothing, reports_deposit_area)
	} else if (uploadMode == "FTP") {
		exports.save2csv("machineRunStatus", sumRunRecord[mchCode], exports.uploadNothing, ftp_log_report)
	}
};

function salesSummarize(mchCode, totalPaid, totalWechat, totalEpay, totalCoin, date) {
	if (!sumSalesRecord[date]) {
		sumSalesRecord[date] = {}
		sumSalesRecord[date].mydate = date
		sumSalesRecord[date].gtp = 0; sumSalesRecord[date].gtw = 0; sumSalesRecord[date].gte = 0; sumSalesRecord[date].gtc = 0;
	}
	var tw = myVI[mchCode].machineName + ".tw"
	var te = myVI[mchCode].machineName + ".te"
	var tc = myVI[mchCode].machineName + ".tc"
	var tp = myVI[mchCode].machineName + ".tp"
	sumSalesRecord[date][tp] = totalPaid;
    sumSalesRecord[date][tw] = totalWechat;
    sumSalesRecord[date][te] = totalEpay;
    sumSalesRecord[date][tc] = totalCoin;
    sumSalesRecord[date].gtp = sumSalesRecord[date].gtp + totalPaid;
    sumSalesRecord[date].gte = sumSalesRecord[date].gte + totalEpay;
    sumSalesRecord[date].gtw = sumSalesRecord[date].gtw + totalWechat;
    sumSalesRecord[date].gtc = sumSalesRecord[date].gtc + totalCoin;
    //updateTotalAll("Total", "Wechat_received", totalWechat)
	//updateTotalAll("Total", "Coin_received", totalCoin)
}

function salesSummarizeTotal(myVI, mchCode, kind, value) {
	if (!sumSalesRecord["Total"]) {
		sumSalesRecord["Total"] = {}
		sumSalesRecord["Total"].mydate = "Total"
	}
	if (mchCode == "Total") {
		if (kind == "Wechat_received") {
			var tag = "gtw"
		} else if (kind == "Epay_received") {
			var tag = "gte"
		} else if (kind == "Coin_received") {
			var tag = "gtc"
		} else if (kind == "TotalP") {
			var tag = "gtp"
		}
	} else {
		if (kind == "Wechat_received") {
			var tag = myVI[mchCode].machineName + ".tw"
		} else if (kind == "Epay_received") {
			var tag = myVI[mchCode].machineName + ".te"
		} else if (kind == "Coin_received") {
			var tag = myVI[mchCode].machineName + ".tc"
		} else if (kind == "TotalP") {
			var tag = myVI[mchCode].machineName + ".tp"
		}
	}
	sumSalesRecord["Total"][tag] = value;
}

function salesSumType(sumAmountBt, date) {
	if (!sumSalesByType["Total"]) {
		sumSalesByType["Total"] = {}
		sumSalesByType["Total"].date = "Total"
	}
    //console.log(sumAmountBt)
	sumSalesByType[date] = Object.assign({}, sumAmountBt);
    sumSalesByType[date].date = date;
    sumSalesByType[date].totalC = 0;
	sumSalesByType[date].totalW = 0;
	sumSalesByType[date].totalE = 0;
	sumSalesByType[date].totalT = 0;
    const lgth = Object.keys(sumAmountBt).length
    //console.log("lgth = " + lgth )
    var counter1 = 0;
    db.serialize(function() {
	    Object.keys(sumAmountBt).forEach(function(k){
	    	if (k.match(/kgC/g) || k.match(/DetC/g)) {
	    		sumSalesByType[date].totalC = sumSalesByType[date].totalC + sumAmountBt[k]
	    	} else if (k.match(/kgW/g) || k.match(/DetW/g)) {
	    		sumSalesByType[date].totalW = sumSalesByType[date].totalW + sumAmountBt[k]
	    	} else if (k.match(/kgE/g) || k.match(/DetE/g)) {
	    		sumSalesByType[date].totalE = sumSalesByType[date].totalE + sumAmountBt[k]
	    	} else if (k.match(/kgT/g) || k.match(/DetT/g)) {
	    		sumSalesByType[date].totalT = sumSalesByType[date].totalT + sumAmountBt[k]
	    	}
	    	//console.log("k is "+k)
	    	var pattern = /[DW][0-9]+kg/g
			var mchKg = k.match(pattern);
			if (k.match(/Det/g)) {
				var mchKg = "Det";
			}
			let sql = 'SELECT Coin c, Wechat w, Epay e, Total t FROM totalValueAllByType WHERE Type = ?';
			db.get(sql, [mchKg.toString()], function(err, row) {
				if (k.match(/kgC/g) ||  k.match(/DetC/g)) {
					sumSalesByType["Total"][k] = row.c + sumAmountBt[k];
					updateTotalAllByType(mchKg.toString(), "Coin", sumAmountBt[k])
				} else if (k.match(/kgW/g) ||  k.match(/DetW/g)) {
					sumSalesByType["Total"][k] = row.w + sumAmountBt[k];
					updateTotalAllByType(mchKg.toString(), "Wechat", sumAmountBt[k])
				} else if (k.match(/kgE/g) ||  k.match(/DetE/g)) {
					sumSalesByType["Total"][k] = row.e + sumAmountBt[k];
					updateTotalAllByType(mchKg.toString(), "Epay", sumAmountBt[k])
				} else if (k.match(/kgT/g) || k.match(/DetT/g) ) {
					sumSalesByType["Total"][k] = row.t + sumAmountBt[k];
					updateTotalAllByType(mchKg.toString(), "Total", sumAmountBt[k])
				}
				counter1++;
				if (counter1 == lgth) {
		    		let sql = 'SELECT Coin c, Wechat w, Epay e, Total t FROM totalValueAllByType WHERE Type = ?';
		    		db.get(sql, ["Total"], function(err, row) {
						sumSalesByType["Total"].totalC = row.c + sumSalesByType[date].totalC
						sumSalesByType["Total"].totalW = row.w + sumSalesByType[date].totalW
						sumSalesByType["Total"].totalE = row.e + sumSalesByType[date].totalE
						sumSalesByType["Total"].totalT = row.t + sumSalesByType[date].totalT
						updateTotalAllByType("Total", "Coin", sumSalesByType[date].totalC)
						updateTotalAllByType("Total", "Wechat", sumSalesByType[date].totalW)
						updateTotalAllByType("Total", "Epay", sumSalesByType[date].totalE)
						updateTotalAllByType("Total", "Total", sumSalesByType[date].totalT)
					})
	    		}
			})
		})
	})
}

function detSumDaily(myVI, mchCode, totalPaid, totalWechat, totalEpay, totalCoin, manualPaid, date, detDrop, softnrDrop, begDrop, totalDrop) {
	if (!sumDetDaily[date]) {
		sumDetDaily[date] = {}
		sumDetDaily[date].mydate = date;
		sumDetDaily[date]["totalP"] = sumDetDaily[date]["totalW"] = sumDetDaily[date]["totalE"] = sumDetDaily[date]["totalM"] = sumDetDaily[date]["totalC"] =sumDetDaily[date]["totalD"] = sumDetDaily[date]["totalS"] = sumDetDaily[date]["totalB"] = sumDetDaily[date]["totalT"] = 0;
	}
	const tw = myVI[mchCode].machineName + "tw"
	const te = myVI[mchCode].machineName + "te"
	const tc = myVI[mchCode].machineName + "tc"
	const tm = myVI[mchCode].machineName + "tm"
	const tp = myVI[mchCode].machineName + "tp"
	const td = myVI[mchCode].machineName + "td"
	const ts = myVI[mchCode].machineName + "ts"
	const tb = myVI[mchCode].machineName + "tb"
	const tt = myVI[mchCode].machineName + "tt"
	sumDetDaily[date][tp] = totalPaid;
	sumDetDaily[date][tw] = totalWechat;
	sumDetDaily[date][te] = totalEpay;
	sumDetDaily[date][tc] = totalCoin;
	sumDetDaily[date][tm] = manualPaid;
	sumDetDaily[date][td] = detDrop;
	sumDetDaily[date][ts] = softnrDrop;
	sumDetDaily[date][tb] = begDrop;
	sumDetDaily[date][tt] = totalDrop;
	sumDetDaily[date]["totalP"] = sumDetDaily[date]["totalP"] + totalPaid;
	sumDetDaily[date]["totalW"] = sumDetDaily[date]["totalW"] + totalWechat;
	sumDetDaily[date]["totalE"] = sumDetDaily[date]["totalE"] + totalEpay;
	sumDetDaily[date]["totalC"] = sumDetDaily[date]["totalC"] + totalCoin;
	sumDetDaily[date]["totalM"] = sumDetDaily[date]["totalM"] + manualPaid;
	sumDetDaily[date]["totalD"] = sumDetDaily[date]["totalD"] + detDrop;
	sumDetDaily[date]["totalS"] = sumDetDaily[date]["totalS"] + softnrDrop;
	sumDetDaily[date]["totalB"] = sumDetDaily[date]["totalB"] + begDrop;
	sumDetDaily[date]["totalT"] = sumDetDaily[date]["totalT"] + totalDrop;
};

function detSumDailyTotal(myVI, mchCode, kind, value) {
	if (!sumDetDaily["Total"]) {
		sumDetDaily["Total"] = {}
		sumDetDaily["Total"].mydate = "Total";
	}
	if (mchCode == "Total") {
		if (kind == "Wechat_received") {
			var tag = "totalW"
		} else if (kind == "Epay_received") {
			var tag = "totalE"
		} else if (kind == "Coin_received") {
			var tag = "totalC"
		} else if (kind == "Manual_payment") {
			var tag = "totalM"
		} else if (kind == "TotalP") {
			var tag = "totalP"
		} else if (kind == "total_det") {
			var tag = "totalD"
		} else if (kind == "total_soft") {
			var tag = "totalS"
		} else if (kind == "total_lb") {
			var tag = "totalB"
		} else if (kind == "TotalT") {
			var tag = "totalT"
		} 
	} else {
		if (kind == "Wechat_received") {
			var tag = myVI[mchCode].machineName + "tw"
		} else if (kind == "Epay_received") {
			var tag = myVI[mchCode].machineName + "te"
		} else if (kind == "Coin_received") {
			var tag = myVI[mchCode].machineName + "tc"
		} else if (kind == "Manual_payment") {
			var tag = myVI[mchCode].machineName + "tm"
		} else if (kind == "TotalP") {
			var tag = myVI[mchCode].machineName + "tp"
		} else if (kind == "total_det") {
			var tag = myVI[mchCode].machineName + "td"
		} else if (kind == "total_soft") {
			var tag = myVI[mchCode].machineName + "ts"
		} else if (kind == "total_lb") {
			var tag = myVI[mchCode].machineName + "tb"
		} else if (kind == "TotalT") {
			var tag = myVI[mchCode].machineName + "tt"
		} 
	}
	sumDetDaily["Total"][tag] = value;
}

function crossOutletSave(data, dest) {
	var tmpObj = {};
	//console.log(data)
	tmpObj.Outlet = data.Outlet;
	tmpObj.Detergent_Unit = data.Detergent_Unit;
	tmpObj.Detergent_Sales = data.Detergent_Sales;
	tmpObj.Softener_Unit = data.Softener_Unit;
	tmpObj.Softener_Sales = data.Softener_Sales;
	tmpObj.LB_Unit = data.LB_Unit;
	tmpObj.LB_Sales = data.LB_Sales;
	totalAllOutlet.Detergent_Unit = totalAllOutlet.Detergent_Unit + data.Detergent_Unit;
	totalAllOutlet.Detergent_Sales = totalAllOutlet.Detergent_Sales + data.Detergent_Sales;
	totalAllOutlet.Softener_Unit = totalAllOutlet.Softener_Unit + data.Softener_Unit;
	totalAllOutlet.Softener_Sales = totalAllOutlet.Softener_Sales + data.Softener_Sales;
	totalAllOutlet.LB_Unit = totalAllOutlet.LB_Unit + data.LB_Unit;
	totalAllOutlet.LB_Sales = totalAllOutlet.LB_Sales + data.LB_Sales;
	dest.push(tmpObj)
}

////////////////////////////////////////////////////
///// Saving all the data into sqlite database /////
////////////////////////////////////////////////////

function detMonthlysave(type,value, type_amt) {
	let sql = 'SELECT * FROM pricing WHERE outlet = ?';
	db.all(sql, [outlet.name], function(err, row) {
		if (err) {
    		return console.error(err.message);
  		}
  		pricing_data = Object.assign({}, row[0]);
  		//console.log(pricing_data)
	})
	var total_amount = 0;
	let sql1 = 'SELECT Amount amount FROM monthlyTotalValue WHERE Type = ?';
	db.get(sql1, [type], function(err, row) {
		//console.log("the data is "+row.amount)
		if (err) {
    		return console.error(err.message);
  		}
  		total_amount = value + row.amount;
  		let sql2 = 'UPDATE monthlyTotalValue SET Amount = ? WHERE Type = ?';
  		data = [total_amount, type]
		db.run(sql2, data, function(err) {
			//console.log(type + " total_amount "+ total_amount);
			if (err) {
    			return console.error(err.message);
  			}
  			//console.log("data has been updated")
		});  		
	})
	let sql3 = 'SELECT Amount amount FROM monthlyTotalValue WHERE Type = ?';
	db.get(sql3, [type_amt], function(err, row) {
		if (type_amt == "Amount_Det") {
			var amt_type = value * pricing_data.detPrice;
		} else if (type_amt == "Amount_Soft") {
			var amt_type = value * pricing_data.softPrice;
		} else if (type_amt == "Amount_LB") {
			var amt_type = value * pricing_data.begPrice;
		}
		//console.log("the data is "+row.amount)
		if (err) {
    		return console.error(err.message);
  		}
  		amt_type = amt_type + row.amount
  		let sql4 = 'UPDATE monthlyTotalValue SET Amount = ? WHERE Type = ?';
  		data2 = [amt_type, type_amt]
		db.run(sql4, data2, function(err) {
			if (err) {
    			return console.error(err.message);
  			}
  			//console.log("data has been updated")
		});  		
	})
}

////////////////////////////////////////////////////////
// Reset the Monthly total value for Det from         //
// the database                                       // 
//                                                    //
////////////////////////////////////////////////////////

function detMonthlyRestart() {
	var types = ['Detergent', 'Softener', 'LB','Amount_Det', 'Amount_Soft', 'Amount_LB']
	var length = Object.keys(types).length;
	//console.log(length)
	types.forEach(function(type, callback) {
  		let sql2 = 'UPDATE monthlyTotalValue SET Amount = 0 WHERE Type = ?';
  		data = [type]
		db.run(sql2, data, function(err) {
			if (err) {
    			return console.error(err.message);
  			}
  			//console.log("data has been updated")
		});  		
	})
}

////////////////////////////////////////////////////////
// Reset the daily total value of run time and sales ///
// from the database                                  // 
//                                                    //
////////////////////////////////////////////////////////


module.exports.dataDailyRestartDryer = function (mchNo, tw, te, tc, tp, tm) {
	let data = [tw, te, tc, tp, tm, mchNo];
	let sql = 'UPDATE dailyTotalValue SET totalWechat = ?, totalEpay = ?, totalCoin = ?, totalPaid = ?, totalManual = ? WHERE MchCode = ?';
	db.run(sql, data, function(err) {
		if (err) {
    		return console.error(err.message);
  		}
  		//console.log("data has been updated")
	});
}

module.exports.dataDailyRestartVending = function (mchNo, tw, te, tc, tp, tm, det, soft, lb, tr) {
	let data = [tw, te, tc, tp, tm, det, soft, lb, tr, mchNo];
	let sql = 'UPDATE dailyTotalValue SET totalWechat = ?, totalEpay = ?, totalCoin = ?, totalPaid = ?, totalManual = ?, detergent = ?, softnr = ?, beg = ?, totalRun = ? WHERE MchCode = ?';
	db.run(sql, data, function(err) {
		if (err) {
    		return console.error(err.message);
  		}
  		//console.log("data has been updated")
	});
}

module.exports.dataDailyRestartWasher = function (mchNo, tw, te, tc, tp, tm, tr, tt, thr, tcr, twr, tor) {
	let data = [tw, te, tc, tp, tm, tr, tt, thr, tcr, twr, tor, mchNo];
	let sql = 'UPDATE dailyTotalValue SET totalWechat = ?, totalEpay = ?, totalCoin = ?, totalPaid = ?, totalManual = ?, totalRun = ?, totalTime = ?, totalHotRun = ?, totalColdRun = ?, totalWarmRun = ?, totalOtherRun = ? WHERE MchCode = ?';
	db.run(sql, data, function(err) {
		if (err) {
    		return console.error(err.message);
  		}
  		//console.log("data has been updated")
	});
}

module.exports.dataDailyRestart = function (mchNo, key, value) {
	let data = [value, mchNo];
	let sql = 'UPDATE dailyTotalValue SET '+key+'= ? WHERE MchCode = ?';
	db.run(sql, data, function(err) {
		if (err) {
    		return console.error(err.message);
  		}
  		//console.log("data has been updated")
	});
}


////////////////////////////////////////////////////////
// query the monthly data for the Det for a particular// 
// month                                              //
////////////////////////////////////////////////////////

function queryMonthlyData(type, month, value, callback) {
	let tmpmonth = month+"_tmp"
	let sql = 'SELECT '+month+' '+tmpmonth+' FROM monthlyDetTotalValue WHERE Type = ?';
	db.get(sql, [type], function(err, row) {
		//console.log("the data is "+row[tmpmonth])
		if (err) {
    		return console.error(err.message);
  		}
  		callback(type, month, value, row[tmpmonth])  		
	})
}

function removeLast(fileName) {
    var splitArray = fs.readFileSync(fileName).toString().split("\n");
    splitArray.pop();
    splitArray.pop();
    var result = splitArray.join('\n');
    fs.writeFileSync(fileName, result)
};




//var mydate = moment().format("DD/MM/YYYY");
//salesSummarize("51a677a2156e87fe4d5c3843cc926839", 20, 10, 10, mydate)
//console.log(sumSalesRecord[moment().format("DD/MM/YYYY")])

//******************************************************//
//////////////////////////////////////////////////////////
// Saving all types of reports to the csv file ///////////
//////////////////////////////////////////////////////////
//******************************************************//

module.exports.save2csv = function(type, data, callback, rda){
	var thisMonth = moment().format("MMMM");
	var thisYear = moment().format("YYYY");
	var cutTime = moment('23:30:00', 'h:mm:ss');
	if (type == "manualPay") {
		//console.log(timenow)
		if (moment().isAfter(cutTime)) {
			if (moment().add(1,'days').format("MMMM") != thisMonth ) {
				thisMonth = moment().add(1,'days').format("MMMM")
			}
		}
		var fname = "Manual_Payment_"+outlet.name+"_"+thisMonth+".csv";
		const typeAppend = manualPayAppend;
		const typeCreate = manualPayCreate;
		const csvPath = manualPayCsv+"_"+thisMonth+".csv";
		if (fs.existsSync(csvPath)) {
			var csv = typeAppend.parse(data) + newLine;
			fs.appendFile(csvPath, csv, function (err) {
				if (err) throw err;
				//console.log('The data was appended to the file');
				callback(csvPath, fname, rda)
			});
		} else {
			var csv = outlet.name + " Manual Payment Report" + newLine + typeCreate.parse(data) + newLine;
			fs.writeFile(csvPath, csv, function(err) {
				if (err) throw err;
				//console.log("The new csv file has been created");
				callback(csvPath, fname, rda)
			});
		}
	} else if (type == "controlMon") {
		//console.log(timenow)
		if (moment().isAfter(cutTime)) {
			if (moment().add(1,'days').format("MMMM") != thisMonth ) {
				thisMonth = moment().add(1,'days').format("MMMM")
			}
		}
		var fname = "Monitoring_record_"+outlet.name+"_"+thisMonth+".csv";
		const typeAppend = controlMonAppend;
		const typeCreate = controlMonCreate;
		const csvPath = ctrlMntrRpt+"_"+thisMonth+".csv";
		if (fs.existsSync(csvPath)) {
			var csv = typeAppend.parse(data) + newLine;
			fs.appendFile(csvPath, csv, function (err) {
				if (err) throw err;
				//console.log('The data was appended to the file');
				callback(csvPath, fname, rda)
			});
		} else {
			var csv = outlet.name + " Monitoring Record Report" + newLine + typeCreate.parse(data) + newLine;
			fs.writeFile(csvPath, csv, function(err) {
				if (err) throw err;
				//console.log("The new csv file has been created");
				callback(csvPath, fname, rda)
			});
		}
	} else if (type == "ePayment") {
		if (moment().isAfter(cutTime)) {
			if (moment().add(1,'days').format("MMMM") != thisMonth ) {
				thisMonth = moment().add(1,'days').format("MMMM")
			}
		}
		var fname = "Epayment_Trans_"+outlet.name+"_"+thisMonth+".csv";
		const typeAppend = ePaymentAppend;
		const typeCreate = ePaymentCreate;
		const csvPath = ePaymentCsv+"_"+thisMonth+".csv";
		if (fs.existsSync(csvPath)) {
			var csv = typeAppend.parse(data) + newLine;
			fs.appendFile(csvPath, csv, function (err) {
				if (err) throw err;
				//console.log('The data was appended to the file');
				callback(csvPath, fname, rda)
			});
		} else {
			var csv = outlet.name + " Epayment Transactions Report" + newLine + typeCreate.parse(data) + newLine;
			fs.writeFile(csvPath, csv, function(err) {
				if (err) throw err;
				//console.log("The new csv file has been created");
				callback(csvPath, fname, rda)
			});
		}
	} else if (type == "chkMachineRun") {
		if (moment().isAfter(cutTime)) {
			if (moment().add(1,'days').format("MMMM") != thisMonth ) {
				thisMonth = moment().add(1,'days').format("MMMM")
			}
		}
		var fname = "MachineRunStatus_"+outlet.name+"_"+thisMonth+".csv"
		const typeAppend = mchStatusAppend;
		const typeCreate = mchStatusCreate;
		const csvPath = chkMachineRun+"_"+thisMonth+".csv";
		if (fs.existsSync(csvPath)) {
			var csv = typeAppend.parse(data) + newLine;
			fs.appendFile(csvPath, csv, function (err) {
				if (err) throw err;
				//console.log('The data was appended to the file');
				callback(csvPath, fname, rda)
			});
		} else {
			var csv = outlet.name + " Machine Run Status Raw Data" + newLine + typeCreate.parse(data) + newLine;
			fs.writeFile(csvPath, csv, function(err) {
				if (err) throw err;
				//console.log("The new csv file has been created");
				callback(csvPath, fname, rda)
			});
		}
	} else if (type == "machineRunStatus") {
		var fname = "DailySum_MachineRunStatus_"+outlet.name+"_"+thisMonth+".csv"
		const typeAppend = sumStatusAppend;
		const typeCreate = sumStatusCreate;
		const csvPath = sumMachineRun+"_"+thisMonth+".csv";
		if (fs.existsSync(csvPath)) {
			var csv = typeAppend.parse(data) + newLine;
			fs.appendFile(csvPath, csv, function (err) {
				if (err) throw err;
				//console.log('The data was appended to the file');
				//callback(csvPath, fname, reports_deposit_area)
			});
		} else {
			var csv = outlet.name + " Machine Run Status Daily Sum Report" + newLine + typeCreate.parse(data) + newLine;
			fs.writeFile(csvPath, csv, function(err) {
				if (err) throw err;
				//console.log("The new csv file has been created");
				//callback(csvPath, fnGame, reports_deposit_area)
			});
		}
	} else if (type == "manualCutOff") {
		var fname = "Manual_CutOff_Report_"+outlet.name+"_"+thisMonth+".csv"
		const typeAppend = cutOffReportAppend;
		const typeCreate = cutOffReportCreate;
		const csvPath = cutOffRpt +"_"+thisMonth+".csv";
		if (fs.existsSync(csvPath)) {
			var csv = typeAppend.parse(data) + newLine;
			fs.appendFile(csvPath, csv, function (err) {
				if (err) throw err;
				//console.log('The data was appended to the file');
				//callback(csvPath, fname, reports_deposit_area)
			});
		} else {
			var csv = outlet.name + "Manual CutOff Report" + newLine + typeCreate.parse(data) + newLine;
			fs.writeFile(csvPath, csv, function(err) {
				if (err) throw err;
				//console.log("The new csv file has been created");
				//callback(csvPath, fnGame, reports_deposit_area)
			});
		}
	} else if (type == "mchSalesSumDaily") {
		var fname = "DailySum_Sales_"+outlet.name+"_"+thisMonth+".csv"
		const typeAppend = sumSalesDailyAppend;
		const typeCreate = sumSalesDailyCreate;
		const csvPath = sumSalesDaily+"_"+thisMonth+".csv";
		if (fs.existsSync(csvPath)) {
			var csv = typeAppend.parse(data) + newLine;
			fs.appendFile(csvPath, csv, function (err) {
				if (err) throw err;
				//console.log('The data was appended to the file');
				callback(csvPath, fname, rda)
			});
		} else {
			var csv = typeAppend.parse(data) + newLine;
			var print  = outlet.name + " Daily Sum Sales Report" + newLine + h4print1 + h4print2 + csv
			fs.writeFile(csvPath, print, 'utf8', function(err) {
				if (err) throw err;
				callback(csvPath, fname, rda)
			})
		}
	} else if (type == "mchSalesbyType") {
		var fname = "DailySum_SalesByType_"+outlet.name+"_"+thisMonth+".csv"
		const typeAppend = sumSalesByTypeAppend;
		const typeCreate = sumSalesByTypeCreate;
		const csvPath = sumSalesTp+"_"+thisMonth+".csv";
		if (fs.existsSync(csvPath)) {
			var csv = typeAppend.parse(data) + newLine;
			fs.appendFile(csvPath, csv, function (err) {
				if (err) throw err;
				//console.log('The data was appended to the file');
				callback(csvPath, fname, rda)
			});
		} else {
			var csv = typeAppend.parse(data) + newLine;
			var print  = outlet.name + " Daily Sum Sales By Type Report" + newLine + h5print1 + h5print2 + csv
			fs.writeFile(csvPath, print, 'utf8', function(err) {
				if (err) throw err;
				//console.log("The new csv file has been created");
				callback(csvPath, fname, rda)
			});
		}
	} else if (type == "sumRunUp2dat") {
		var fname = "SumRun_Up2Date_"+outlet.name+"_"+thisMonth+".csv"
		const typeCreate = sumRunUp2dateCreate;
		const csvPath = sumRunUp2date+"_"+thisMonth+".csv";
		if (fs.existsSync(csvPath)) {
			var csv = outlet.name + " Up to Date Run Data" + newLine + typeCreate.parse(data);
			//console.log(csv)
			fs.writeFile(csvPath, csv, function(err) {
				if (err) throw err;
				//console.log("The report has been updated");
				callback(csvPath, fname, rda)
			});
		}  else {
			var csv = outlet.name + " Up to Date Run Data" + newLine + typeCreate.parse(data);
			//console.log("The report is not there, creating a new one")
			fs.writeFile(csvPath, csv, function(err) {
				if (err) throw err;
				callback(csvPath, fname, rda)
			});
		}
	} else if (type == "sumDetSalesDaily") {
		var fname = "DailyDet_SalesUnit_"+outlet.name+"_"+thisMonth+".csv"
		const typeAppend = sumDetDailyAppend;
		const typeCreate = sumDetDailyCreate;
		const csvPath = sumDetSnU+"_"+thisMonth+".csv";
		if (fs.existsSync(csvPath)) {
			var csv = typeAppend.parse(data) + newLine;
			//console.log(csv)
			fs.appendFile(csvPath, csv, function (err) {
				if (err) throw err;
				//console.log('The data was appended to the file');
				callback(csvPath, fname, rda)
			});
		} else {
			var csv = typeAppend.parse(data) + newLine;
			var print = outlet.name + " Daily Vending Sales Unit Report" + newLine + h7print1 + h7print2 + h7print3 + csv
			fs.writeFile(csvPath, print, function(err) {
				if (err) throw err;
				callback(csvPath, fname, rda)
			});
		}
	} else if (type == "detMonthlyUpdate") {
		var fname = "Det_SalesUnit_"+outlet.name+"_"+thisYear+".csv"
		const typeCreate = detMonthlyCreate;
		const typeAppend = detMonthlyAppend;
		const csvPath = detMonthly+"_"+thisYear+".csv";
		var csv = typeAppend.parse(data);
		var print = outlet.name + " Vending Monthly Sales Unit Report" +  newLine + h8print + csv;
		//console.log(csv)
		fs.writeFile(csvPath, print, function(err) {
			if (err) throw err;
			//console.log("The report has been updated");
			callback(csvPath, fname, rda)
		});
	} else if (type == "crossOutletDet") {
		var lastMonth = moment().subtract(1,'months').format("MMMM")
		var fname = "Det_AllOutlet_"+lastMonth+".csv"
		const typeCreate = xOutletMonthlyCreate;
		const csvPath = crossOutletMonthly+"_"+lastMonth+".csv";
		var csv = outlet.name + " All Outlet Vending Monthly Sales Unit Report" + newLine + typeCreate.parse(data);
		fs.writeFile(csvPath, csv, function(err) {
			if (err) throw err;
			//console.log("The report has been updated");
			callback(csvPath, fname, rda)
		});

	} else if (type == "allDetMonthlyUpdate") {
		if (moment().subtract(1,'days').format("YYYY") != thisYear ) {
			thisYear = moment().subtract(1,'days').format("YYYY")
		}
		var fname = "Det_SalesUnit_AllOutlet_"+thisYear+".csv"
		const typeCreate = detMonthlyAllCreate;
		const typeAppend = detMonthlyAllAppend;
		const csvPath = detMonthlyAllOutlet+"_"+thisYear+".csv";
		var csv = typeAppend.parse(data);
		var print = outlet.name + " All Outlet Vending Yearly Sales Unit Report" + newLine + h8print + csv;
		//console.log(csv)
		fs.writeFile(csvPath, print, function(err) {
			if (err) throw err;
			//console.log("The report has been updated");
			callback(csvPath, fname, rda)
		});
	}
}

module.exports.uploadNothing = function(fpath, fname, dfolder) {
	
}

///// Transfer the files to the google drive by upload or update

module.exports.upload2GD = function(fpath, fname, dfolder) {
	fs.readFile('./credentials/credentials.json', (err, content) => {
	  if (err) return console.log('Error loading client secret file:', err);
	  // Authorize a client with credentials, then call the Google Drive API.
	 	if (mode == "production") {
	 		googleapi.updateOrupload(JSON.parse(content), googleapi.listFiles, fpath, fname , dfolder)
		} else {
			console.log("Uploading......")
		}
	});
}


///// Transfer files using the FTP /////////
module.exports.authFTP = function(user, pw) {
	Ftp.auth(user, pw, function(err) {
	     if (err) {
	     	console.log(err)
	     	return
	     }
	     console.log("auth succesfull")
	});
}

module.exports.uploadFilesFTP = function(source_path, dest_name, dest_folder) {
	var dest_path = dest_folder + "/" + dest_name
	console.log("from "+ source_path + "to " + dest_path)
	var ftup = {};
	ftup.sp = source_path;
	ftup.dp = dest_path;
	file2Upload.push(ftup)
}

async function upload2FTP(ftu) {
    const client = new ftp.Client()
    //client.ftp.verbose = true
    return await new Promise(async function(resolve, reject) {
        try {
	        await client.access({
	                host: outlet.host,
	                port: "21",
	                user: outlet.ftpUser,
	                password: outlet.ftpPw,
	        })
	        //console.log(await client.list())
	        //console.log(arr)
	        var dest_path = ftu.dp
	        var source_path = ftu.sp
	        await client.upload(fs.createReadStream(source_path), dest_path)
	        resolve()
	        //console.log(arr)
    	}
        catch(err) {
            reject(err)
            console.log(err)
        }
        client.close()
    })
}

function ftpUp(arr) {
    return arr.reduce((promise, ftu) =>
	    promise.then(()=> {
	            return upload2FTP(ftu)
	            .catch(console.log);
	    }), Promise.resolve());
}



module.exports.downloadFilesFTP = async function(dest_path, source_name, source_folder) {
	var source_path = source_folder + "/" + source_name
	 const client = new ftp.Client()
    //client.ftp.verbose = true
    return await new Promise(async function(resolve, reject) {
        try {
	        await client.access({
	                host: outlet.host,
	                port: "21",
	                user: outlet.ftpUser,
	                password: outlet.ftpPw,
	        })
	        //console.log(await client.list())
	        //console.log(arr)
	        await client.download(fs.createWriteStream(dest_path), source_path)
	        resolve()
	        //console.log(arr)
    	}
        catch(err) {
            reject(err)
            console.log(err)
        }
        client.close()
    })
}

//querydata("Detergent", "January", 5, updateDetMonthlytotal);
// Load client secrets from a local file.
//fs.readFile('credentials.json', (err, content) => {
//  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Drive API.
//  googleapi.authorize(JSON.parse(content), googleapi.listFiles,googleapi.uploadFiles, sumRunUp2date);
//});
