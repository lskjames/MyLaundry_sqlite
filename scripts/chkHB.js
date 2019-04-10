
var nodemailer = require('nodemailer'); 
var moment = require('moment')
var fs = require('fs');
const outlet = require('../data/outlet.js')
//var varItem = require('../credentials/variables.js');

var newLine = "\r\n";

var transporter = nodemailer.createTransport({
	host: 'smtp.gmail.com',
    port: 465,
    secure: true, // use SSL
	auth:{
		user: outlet.email,
		pass: outlet.gmailpw
	}
});

module.exports.checkHeartbeat = function(varItem) {
	Object.keys(varItem).forEach(function(key) {
		var activity = varItem[key].active;
		var doneSent = varItem[key].sent;
		var thisMonth = moment().format("MMMM")
		if (activity) {
			console.log("the device " + key+ "  "+ varItem[key].machineName + " is connected")
			if (doneSent) {
				var mailOptions = {
					from: outlet.email,
					to: 'jamesleesukey@gmail.com',
					subject: 'Sending Email to notify that the falty machine is back to normal condition',
					text: key+"  "+varItem[key].machineName+" is working normally now."
				};
				// transporter.sendMail(mailOptions, function(error, info){
				// 	if (error) {
				// 		console.log(error);
				// 	} else {
				// 		console.log('Email sent: ' + info.response);
				// 	}
				// });
				var timeNow = moment().format("DD/MM/YYYY HH:mm:ss")
				var print = varItem[key].machineName + "," + "Online," + timeNow + newLine
				const csvPath = "./reports/devices_disconnection"+"_"+thisMonth+".csv";
				if (fs.existsSync(csvPath)) {	
					fs.appendFile(csvPath, print, 'utf8', function(err) {
						if (err) throw err;
					//console.log("The new csv file has been created")
					});	
				} else {
					var print2 = outlet.name + " Devices Disconnection Log" + newLine + print
					fs.writeFile(csvPath, print2, 'utf8', function(err) {
						if (err) throw err;
					//console.log("The new csv file has been created")
					});
				}
				varItem[key].sent = false
			}				
		} else {
			if (doneSent) {
			} else {
				var mailOptions = {
					from: outlet.email,
					to: 'jamesleesukey@gmail.com',
					subject: 'Sending Email to notify that one of the machine is not functioning',
					text: key+"  "+varItem[key].machineName+" is not functioning, please check it out. Epayment to this machine is disabled."
				};
				// transporter.sendMail(mailOptions, function(error, info){
				// 	if (error) {
				// 		console.log(error);
				// 	} else {
				// 		console.log('Email sent: ' + info.response);
				// 	}
				// });
				var timeNow = moment().format("DD/MM/YYYY HH:mm:ss")
				var print = varItem[key].machineName + "," + "Offline," + timeNow + newLine
				const csvPath = "./reports/devices_disconnection"+"_"+thisMonth+".csv";
				if (fs.existsSync(csvPath)) {	
					fs.appendFile(csvPath, print, 'utf8', function(err) {
						if (err) throw err;
					//console.log("The new csv file has been created")
					});	
				} else {
					var print2 = outlet.name + " Devices Disconnection Log" + newLine + print
					fs.writeFile(csvPath, print2, 'utf8', function(err) {
						if (err) throw err;
					//console.log("The new csv file has been created")
					});
				}
				varItem[key].sent = true
			}
		}
	});
}
