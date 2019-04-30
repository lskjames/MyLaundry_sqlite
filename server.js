/////////////////////////////////////
///// Required Packages /////////////
/////////////////////////////////////

var express = require('express');
var myParser = require("body-parser");
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var ss = require('socket.io-stream');
var querystring = require('querystring');
var json2csvParser = require('json2csv').Parser;
var nodemailer = require('nodemailer');
var paperboy = require('./lib/paperboy');
var varItem = require('./credentials/variables.js');
var path = require('path');
var myWebroot = path.join(path.dirname(__filename), 'webroot');
var parseurl = require('parseurl');
var session = require('express-session');
var schedule = require('node-schedule');
var mustacheExpress = require('mustache-express');
var math = require('math');
var crypto = require('crypto');
var chkHeartbeat = require('./scripts/chkHB.js')
var rpting = require('./scripts/reporting.js')
var mymqtt = require('./scripts/mqtt.js')
var rmapi = require('./scripts/RMapi.js')
var moment = require('moment');
var childProcess = require('child_process');
const outlet = require('./data/outlet.js')
var reports_deposit_area = outlet.rptFolderID
var githubUsername = outlet.ghusn
var fs = require('fs');

var transporter = nodemailer.createTransport({
	host: 'smtp.gmail.com',
    port: 465,
    secure: true, // use SSL
	auth:{
		user: outlet.email,
		pass: outlet.gmailpw
	}
});
var doneSent = 0;
var counting = 0;
var doneReset = 0;
var noPing = 0;
const mode = "Test";
const sqlite3 = require('sqlite3').verbose();
const ePaymentCsv = "EpaymentReport";
const data = require('./auth/userData.js');
const data2 = require('./auth/data.js');

var cutOffTemp = {}
var cutOffGroup = {}
var pricing_data = {}
var transIDdata = {}

// const Gpio = require('onoff').Gpio;
// const jamming = new Gpio(4, 'in', 'rising');

// jamming.watch((err, value) => {
//      if (err) {
//              throw err;
//      }
//      console.log("it is jamming now")
//      counting++
//      if (counting == 15) {
//          if (!doneSent) {
//              var mailOptions = {
//                      from: outlet.email,
//                      to: 'jamesleesukey@gmail.com',
//                      subject: 'Sending Email to notify that someone is jamming the network at' + outlet.name ,
//                      text: 'Please check !!!'
//              };
//              transporter.sendMail(mailOptions, function(error, info){
//                      if (error) {
//                              console.log(error);
//                      } else {
//                              console.log('Email sent: ' + info.response);
//                      }
//              });
//              doneSent = 1;
//              counting = 0;
//          }
//      } else if (counting == 1000) {
//              doneSent = 0;
//              counting = 0;
//      }
// })

app.engine('mustache', mustacheExpress());
app.set('views', './views');
app.set('view engine', 'mustache');
app.use(myParser.urlencoded({extended : false}));
app.use(myParser.json());
app.use(session({
	secret: 'keyboard cat',
	resave: false,
	saveUninitialized: true
}));

app.use(function (req, res, next) {
	var views = req.session.views;

	if (!views) {
		views = req.session.views = {};
	}

	//get the url pathname
	var pathname = parseurl(req).pathname;

	// count the views
	views[pathname] = (views[pathname] || 0) + 1
	next();
})


function authenticate_admin(req, res, username, password) {
	let db = new sqlite3.Database('./mydb/laundry.db', sqlite3.OPEN_READWRITE, (err) => {
	  	if (err) {
	    	console.error(err.message);
	  	}
  		console.log('Connected to the laundry database.');
	});
	var userfound = false;
	db.serialize(function() {
		let sql = 'SELECT username us FROM admin';
		db.all(sql, [], function(err, row) {
			console.log(row.length)
			const length = row.length;
			for(var i = 0; i < length; i++){
				console.log(row[i])
				if(row[i].us == username) {
					userfound = true;
					console.log("user found")
				} else {
					console.log("user not matched")
				}
			}
			if (userfound) {
				var password_md5 = crypto.createHash('md5').update(password).digest('hex');
				let sql2 = 'SELECT password pw, role r FROM admin WHERE username = ?';
				db.get(sql2, [username], function(err, row) {
					if (password_md5 == row.pw) {
						req.session.authenticated = true;
						req.session.username = username;
						req.session.role = row.r;
						console.log('User & Password Authenticated! '+ req.session.role);
                        console.log(req.session)
						//return req.session;
						//db.close();
					} else if (password == row.pw) {
						req.session.authenticated = true;
						req.session.username = username;
						req.session.role = row.r;
						console.log('User & Password Authenticated '+ req.session.role);
						console.log(req.session)
						//return req.session;
						//db.close();
					} else {
						req.session.authenticated = false;
					}
					if (req.session && req.session.authenticated){
						console.log("testing")
						if (req.session.role == "developer") {
							//console.debug("its developer")
							res.render('updateFw', { url: outlet.url, users: data2.users, brand: outlet.brand});
						} else if (req.session.role == "admin") {
							var tmpdata = []
							Object.keys(varItem).forEach(function(k){
								tmpdata.push(varItem[k])
							})
							console.log("its admin")
							res.render('admin_execution',{ url: outlet.url, machines: tmpdata, brand: outlet.brand, outlet: outlet.name});
						}
					} else {
						res.render('index', {brand: outlet.brand, outlet: outlet.name, message2: "Login Failed, please try again.", reply: "failed2"})
					}
				})
			} else {
				req.session.authenticated = false;
				res.render('index', {brand: outlet.brand, outlet: outlet.name, message2: "User not found !", reply: "failed2"})
			}	
		})
			
		//console.log(req.session);
	})

	//
	
}

function authenticate_user(req, res, username, password) {
	let db = new sqlite3.Database('./mydb/laundry.db', sqlite3.OPEN_READWRITE, (err) => {
	  	if (err) {
	    	console.error(err.message);
	  	}
  		console.log('Connected to the laundry database.');
	});
	var userfound = false;
	db.serialize(function() {
		let sql = 'SELECT username us FROM users';
		db.all(sql, [], function(err, row) {
			console.log(row.length)
			const length = row.length;
			for(var i = 0; i < length; i++){
				console.log(row[i])
				if(row[i].us == username) {
					userfound = true;
					console.log("user found")
				} else {
					console.log("user not matched")
				}
			}
			if (userfound) {
				var password_md5 = crypto.createHash('md5').update(password).digest('hex');
				let sql = 'SELECT password pw, status act FROM users WHERE username = ?';
				db.get(sql, [username], function(err, row) {
					if (password_md5 == row.pw) {
						req.session.authenticated = true;
						req.session.username = username;
						req.session.actv = row.act;
						console.log('User & Password Authenticated!');
						db.close();
					} else if (password == row.pw) {
						req.session.authenticated = true;
						req.session.username = username;
						req.session.actv = row.act;
						console.log('User & Password Authenticated');
						db.close();
					} else {
						req.session.authenticated = false;
					}
					if (req.session && req.session.authenticated) {
						if (req.session.actv == "Active") {
							var tmpdata = []
							Object.keys(varItem).forEach(function(k){
								tmpdata.push(varItem[k])
							})
							res.render('execution',{ url: outlet.url, machines: tmpdata, brand: outlet.brand, outlet: outlet.name});
						} else if (req.session.actv == "Inactive") {
							res.render('index', {brand: outlet.brand, outlet: outlet.name, message1: "Please consult your manager for Account Activation.", reply: "failed"})
						}
					} else {
						res.render('index', {brand: outlet.brand, outlet: outlet.name, message1: "Login Failed, please try again.", reply: "failed"})
					}
				})
			} else {
				req.session.authenticated = false;
				res.render('index', {brand: outlet.brand, outlet: outlet.name, message1: "User not found !", reply: "failed"})
			}
		})
				
	})
}

app.use((req, res, next) => {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
	res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
	res.setHeader('Access-Control-Allow-Credentials', true);
	next();
});

app.use(express['static']('public'));

///////////////////////////////////////////
////// INIT AND START MQTT CONNECTION /////
///////////////////////////////////////////
io.on('connection', function (socket) { // Notify for a new connection and pass the socket as parameter.
    console.log('new connection');
    ///socket.emit("devices")
    var incremental = 0;
    var update = setInterval(function () {
     	var tmpdata = []
		const viCount = Object.keys(varItem).length;
		var count = 0;
		Object.keys(varItem).forEach(function(k){
			count++;
			if (varItem[k].typeOfMachine.match("dex_dryer_double")) {
				if (!tmpdouble_top) {
					var tmpdouble_top = {}
				}
				if (!tmpdouble_bot) {
					var tmpdouble_bot = {}
				}
				if (varItem[k].active == true) {
					tmpdouble_top.active = "Online"
					tmpdouble_bot.active = "Online"
				} else if (varItem[k].active == false) {
					tmpdouble_bot.active = "Offline"
					tmpdouble_top.active = "Offline"
				}
				if (varItem[k].check == true) {
					tmpdouble_top.check = "On"
					tmpdouble_bot.check = "On"
				} else if (varItem[k].check == false) {
					tmpdouble_bot.check = "Off"
					tmpdouble_top.check = "Off"
				}
				tmpdouble_top.version = varItem[k].version
				tmpdouble_bot.version = varItem[k].version
				if (varItem[k].locked.upper == true) {
					tmpdouble_top.locked = "Running";
					if (!tmpdouble_top.machineName) {
						var pattern = /[A-Z]+\-D[0-9]+/g
						var top = varItem[k].machineName.match(pattern)
						var topname = top.toString()
						tmpdouble_top.machineName = topname
					}
				} else {
					tmpdouble_top.locked = "Standby";
					if (!tmpdouble_top.machineName) {
						var pattern = /[A-Z]+\-D[0-9]+/g
						var top = varItem[k].machineName.match(pattern)
						var topname = top.toString()
						tmpdouble_top.machineName = topname
					}
				}
				if (varItem[k].locked.lower == true) {
					tmpdouble_bot.locked = "Running";
					if (!tmpdouble_bot.machineName) {
						var pattern2 = /[0-9]+$/g
						var bot  = varItem[k].machineName.match(pattern2)
						var botname = outlet.name + "-D" + bot
						tmpdouble_bot.machineName = botname
					}				
				} else {
					tmpdouble_bot.locked = "Standby";
					if (!tmpdouble_bot.machineName) {
						var pattern2 = /[0-9]+$/g
						var bot  = varItem[k].machineName.match(pattern2)
						var botname = outlet.name + "-D" + bot
						tmpdouble_bot.machineName = botname
					}
				}
				tmpdata.push(tmpdouble_top)
				tmpdata.push(tmpdouble_bot)
			} else {
				var tmpMachine = {}
				tmpMachine = Object.assign({}, varItem[k])
				if (varItem[k].active == true) {
					tmpMachine.active = "Online"
				} else if (varItem[k].active == false) {
					tmpMachine.active = "Offline"
				}
				if (varItem[k].locked == true) {
					tmpMachine.locked = "Running"
				} else if (varItem[k].locked == false) {
					tmpMachine.locked = "Standby"
				}
				if (varItem[k].typeOfMachine == "detergent") {
					tmpMachine.locked = "Standby"
				}
				if (varItem[k].check == true) {
					tmpMachine.check = "On"
				} else if (varItem[k].check == false) {
					tmpMachine.check = "Off"
				}
				tmpdata.push(tmpMachine)
			}
			if (count == viCount) {
				socket.emit("devices", tmpdata); // Emit on the opened socket.
			}
		})
     }, 2000);
    socket.on('disconnect', function() {
      console.log('Got disconnect!');
      clearInterval(update)
    })
});

io.of('/reports').on('connection', function(socket) {
  var dailySales = "DailySum_Sales_"+outlet.name+"_March"

  ss(socket).on('DailySum_Sales_PJ21_March', function(stream) {
    fs.createReadStream('./reports/DailySum_Sales_PJ21_March.csv').pipe(stream);
  });
  ss(socket).on('DailySum_Sales_PJ21_March', function(stream) {
    fs.createReadStream('./reports/DailySum_Sales_PJ21_March.csv').pipe(stream);
  });
  ss(socket).on('DailySum_Sales_PJ21_March', function(stream) {
    fs.createReadStream('./reports/DailySum_Sales_PJ21_March.csv').pipe(stream);
  });
  ss(socket).on('DailySum_Sales_PJ21_March', function(stream) {
    fs.createReadStream('./reports/DailySum_Sales_PJ21_March.csv').pipe(stream);
  });
  ss(socket).on('DailySum_Sales_PJ21_March', function(stream) {
    fs.createReadStream('./reports/DailySum_Sales_PJ21_March.csv').pipe(stream);
  });
  ss(socket).on('DailySum_Sales_PJ21_March', function(stream) {
    fs.createReadStream('./reports/DailySum_Sales_PJ21_March.csv').pipe(stream);
  });
});

refreshValue(varItem, mymqtt.mqttCN, mymqtt.mqttSUB)

/////////////////////////////////////
////CHECK HEARTBEAT /////////////////
/////////////////////////////////////

/////////// update all the daily recorded data ////////

setInterval(chkHeartbeat.checkHeartbeat, 60000, varItem);
// schedule.scheduleJob('00 30 23 * * *', function(){
if (mode == "production") {
	console.log("its production")
	schedule.scheduleJob('00 30 23 * * *', function(){
		rpting.schedulej(varItem);
		rpting.scheduleD(varItem);
	})

	schedule.scheduleJob('00 34 23 * * *', function(){
		rpting.scheduleE();
		backupReports();
	})
	// /////////// update the monthly detergent sales unit for this branch //////
	
	schedule.scheduleJob('00 00 01 * * *', function(){
		rpting.scheduleZ();
	})

	schedule.scheduleJob('00 00 00 1 * *', function(){
	//schedule.scheduleJob('00 53 17 * * *', function(){
		rpting.scheduleA(varItem);
	})

	schedule.scheduleJob('00 04 00 1 * *', function(){
		rpting.scheduleE();
		backupMonthlyReport();
	})

	///// schedule jobs for updating report no1, no2 and no5 ///////
	//schedule.scheduleJob('00 13 23 * * *', function(){
	schedule.scheduleJob('00 30 08 * * *', function(){
		rpting.scheduleD(varItem);
	})

	schedule.scheduleJob('00 34 08 * * *', function(){
		rpting.scheduleE();
	})

	schedule.scheduleJob('00 00 18 * * *', function(){
	//schedule.scheduleJob('00 45 20 * * *', function(){
		rpting.scheduleD(varItem);
	})

	schedule.scheduleJob('00 04 18 * * *', function(){
		rpting.scheduleE();
	})

	//rmapi.queryQRcodes();

	if (outlet.name == "PJCC") {

	//////// update the cross outlet det sales unit data //////////////
	/// temp comment out since other other are not ready yet.
		schedule.scheduleJob('00 20 00 1 * *', function(){
			rpting.scheduleB();
		})

		schedule.scheduleJob('00 30 00 1 * *', function(){
			rpting.scheduleC();
		})

		schedule.scheduleJob('00 35 00 1 * *', function(){
			rpting.scheduleE();
		})
	}

	if (outlet.name == "SP" || outlet.name == "PJ21") {
		// schedule.scheduleJob('00 30 03 * * *', function(){
		// 	resetTux();
		// })
		checkFlag();
		var timeoutHandle = setTimeout(dropped, 360000);
	}
}

/////////////////////////////////////
////// FUNCTION DECLARATION /////////
/////////////////////////////////////


function object_value (object) {
	var val = [];
	Object.keys(object).forEach(function(k) {
		val.push(object[k]);
	})
	return val;
}

/// initialize value from the database 

function refreshValue (VI, callback1, callback2) {
	let db = new sqlite3.Database('./mydb/laundry.db', sqlite3.OPEN_READONLY, (err) => {
  	if (err) {
    	console.error(err.message);
  	}
  	console.log('Connected to the laundry database.');
	});
	db.serialize(function() {
		Object.keys(VI).forEach(function(k) {
			if (VI[k].typeOfMachine.match(/dex_dryer_double/g)) {
				let sql = 'SELECT totalTimeTop ttt, totalTimeBot ttb, totalRun tr, startTimeTop stt, startTimeBot stb, lockedTop lt, lockedBot lb, coinPaidTop cpt, coinPaidBot cpb, wechatPaidTop wpt, wechatPaidBot wpb, epayPaidTop ept, epayPaidBot epb, manualPaidTop mpt, manualPaidBot mpb, amountPaidTop apt, amountPaidBot apb FROM dailyTotalValue WHERE MchCode = ?';
				db.get(sql, [k], function(err, row) {
					if (err) {
	    				return console.error(err.message);
	  				}
	  				VI[k].totalTime.upper = row.ttt
					VI[k].totalTime.lower = row.ttb
					VI[k].totalRun = row.tr
					VI[k].startTime.upper = row.stt
					VI[k].startTime.lower = row.stb
					if (row.lt == 0) {
						VI[k].locked.upper = false;
						console.log(k+" top is not running previously")
					} else if (row.lt == 1) {
						VI[k].locked.upper = true;
						console.log(k+" top is running previously")
					}
					if (row.lb == 0) {
						VI[k].locked.lower = false;
						console.log(k+" bot is not running previously")
					} else if (row.lb == 1) {
						VI[k].locked.lower = true;
						console.log(k+" bot is running previously")
					}
					VI[k].coinPaidTop = row.cpt; VI[k].coinPaidBot = row.cpb; 
					VI[k].wechatPaidTop = row.wpt; VI[k].wechatPaidBot = row.wpb;
					VI[k].epayPaidTop = row.ept; VI[k].epayPaidBot = row.epb;
					VI[k].manualPaidTop = row.wpt; VI[k].manualPaidBot = row.mpb;
					VI[k].amountPaidTop = row.wpt; VI[k].amountPaidBot = row.apb;
				})
			} else if (VI[k].typeOfMachine == "detergent") {
				let sql = 'SELECT totalRun tr, detergent d, softnr s, beg b, myDet md, mySoft ms, myLb ml FROM dailyTotalValue WHERE MchCode = ?';
				db.get(sql, [k], function(err, row) {
					if (err) {
	    				return console.error(err.message);
	  				}
	  				//console.log(VI[k].totalTime.upper) 
	  				VI[k].detergent = row.d
					VI[k].softnr = row.s
					VI[k].beg = row.b
					VI[k].myDet = row.md
					VI[k].mySoft = row.ms
					VI[k].myLb = row.ml
					VI[k].totalRun = row.tr
					//console.log(VI[k].totalTime.upper)
				})
			} else if (VI[k].typeOfMachine.match(/Washer/g)){
				let sql = 'SELECT totalTime tt, totalRun tr, totalColdRun tcr, totalWarmRun twr, totalHotRun thr, totalOtherRun tor, startTime st, locked lock FROM dailyTotalValue WHERE MchCode = ?';
				db.get(sql, [k], function(err, row) {
					if (err) {
	    				return console.error(err.message);
	  				}
	  				//console.log(VI[k].coldRun) 
	  				VI[k].totalTime = row.tt
					VI[k].totalRun = row.tr; VI[k].coldRun = row.tcr; VI[k].warmRun = row.twr; VI[k].hotRun = row.thr; VI[k].otherRun = row.tor;
					VI[k].startTime = row.st
					if (row.lock == 0) {
						VI[k].locked = false;
						console.log(k+" is not running previously")
					} else if (row.lock == 1) {
						VI[k].locked = true;
						console.log(k+" is running previously")
					}
					//console.log(VI[k].coldRun)
				})
			} else if (VI[k].typeOfMachine.match(/dryer/g)){
				let sql = 'SELECT totalTime tt, totalRun tr, startTime st, locked lock FROM dailyTotalValue WHERE MchCode = ?';
				db.get(sql, [k], function(err, row) {
					if (err) {
	    				return console.error(err.message);
	  				}
	  				//console.log(VI[k].totalTime)
	  				VI[k].totalTime = row.tt
	  				VI[k].totalRun = row.tr
	  				VI[k].startTime = row.st
	  				if (row.lock == 0) {
						VI[k].locked = false;
						console.log(k+" is not running previously")
					} else if (row.lock == 1) {
						VI[k].locked = true;
						console.log(k+" is running previously")
					}
	  				//console.log(VI[k].totalTime)
	  			})
	  		}
			let sql0 = 'SELECT totalPaid tp, totalCoin tc, totalWechat tw, totalEpay te, wechatPaid wp, wechatPaidtmp wpt, epayPaid ep, epayPaidtmp ept, coinPaid cp, amountPaid ap, manualPaid mp, manualPaidtmp mpt, version v, mygroup mg, totalManual tm, checking chk FROM dailyTotalValue WHERE MchCode = ?';
			db.get(sql0, [k], function(err, row) {
				if (err) {
	    			return console.error(err.message);
	  			}
				VI[k].amountPaid = row.ap
				VI[k].coinPaid = row.cp
				VI[k].wechatPaid = row.wp
				VI[k].manualPaid = row.mp
				VI[k].epayPaid = row.ep
				VI[k].wechatPaidtmp = row.wpt
				VI[k].manualPaidtmp = row.mpt
				VI[k].epayPaidtmp = row.ept
				VI[k].totalManual = row.tm
				VI[k].totalPaid = row.tp
				VI[k].totalCoin = row.tc
				VI[k].totalWechat = row.tw
				VI[k].totalEpay = row.te
				VI[k].version = row.v
				VI[k].group = row.mg
				VI[k].check = row.chk
			})
			let sql2 = 'SELECT totalCoin tc, cutOffTC ctc, totalDet td, cutOffTD ctd, totalSoft ts, cutOffTS cts, totalBeg tb, cutOffTB ctb, startTime st, lastCFtime lcft, mystatus mst, cutOffBy cfb FROM cutOffTotalValue WHERE MchCode = ?';
			db.get(sql2, [k], function(err, row) {
				if (err) {
	    			return console.error(err.message);
	  			}
	  			VI[k].cutOffTC = row.tc
	  			VI[k].cutOffTD = row.td
	  			VI[k].cutOffTS = row.ts
	  			VI[k].cutOffTB = row.tb
	  			VI[k].cutOffST = row.st
	  			VI[k].status = row.mst
	  			if (!cutOffTemp[row.st]) {
	  				cutOffTemp[row.st] = {}
	  			} 
	  			if (!cutOffTemp[row.st][k]) {
	  				cutOffTemp[row.st][k] = {};
	  			}
				cutOffTemp[row.st][k].cutOffBy = row.cfb
				cutOffTemp[row.st][k].cutOffTC = row.ctc
				cutOffTemp[row.st][k].cutOffTD = row.ctd
				cutOffTemp[row.st][k].cutOffTS = row.cts
				cutOffTemp[row.st][k].cutOffTB = row.ctb
				cutOffTemp[row.st][k].lastCutoff = row.lcft
	  		})
		})
		let sql = 'SELECT * FROM pricing WHERE outlet = ?';
		db.all(sql, [outlet.name], function(err, row) {
			if (err) {
	    		return console.error(err.message);
	  		}
	  		pricing_data = Object.assign({}, row[0]);
	  		console.log(pricing_data)
		})
		let sql3 = 'SELECT transid tid FROM transID'
		db.all(sql3, [], function(err, row) {
			if (err) {
	    		return console.error(err.message);
	  		}
	  		for (i = 0; i < row.length; i++) {
	  			transIDdata[row[i].tid] = {}
	  			transIDdata[row[i].tid].done = "Yes";
	  			//console.log(transIDdata)
	  			setTimeout(deleteTransID, 7200000, row[i].tid);
	  		}
	  	})
	  	let sql4 = 'SELECT MyGroup mg, cutOffTime cft, theStatus sts FROM cutOffgroup';
		db.all(sql4, [], function(err, row) {
			if (err) {
				return console.error(err.message);
			}
			//console.log(row)
			for (i = 0; i < row.length; i++) { 
				cutOffGroup[row[i].mg] = {}
				cutOffGroup[row[i].mg].MyGroup = row[i].mg;
				cutOffGroup[row[i].mg].cutOffTime = row[i].cft;
				cutOffGroup[row[i].mg].theStatus = row[i].sts;
				//console.log(cutOffGroup)
			}
			// console.log(cutOffGroup[k])
		})
		callback1();
		callback2(VI, pricing_data);
	})
	db.close();
}

function deleteGroup (grp) {
	let db = new sqlite3.Database('./mydb/laundry.db', sqlite3.OPEN_READWRITE, (err) => {
		if (err) {
			console.error(err.message);
		}
		console.log('Connected to the laundry database.');
	});
	let sql3 = 'DELETE FROM cutOffgroup WHERE MyGroup = ?';
	db.run(sql3, [grp], function(err, row) {
		if (err) {
			return console.error(err.message);
		}
	})
}

function addGroup (newGrp) {
	let db = new sqlite3.Database('./mydb/laundry.db', sqlite3.OPEN_READWRITE, (err) => {
		if (err) {
			console.error(err.message);
		}
		console.log('Connected to the laundry database.');
	});
	//INSERT INTO users(username, password, status) VALUES(?,?,?)
	let sql3 = 'INSERT INTO cutOffGroup(MyGroup, cutOffTime, theStatus) VALUES(?,?,?)';
	let data = [newGrp.MyGroup, newGrp.cutOffTime, newGrp.theStatus]
	db.run(sql3, data, function(err, row) {
		if (err) {
			return console.error(err.message);
		}
	})
}

// rendering function for epayment 

//rmapi.queryQRcodes()

function render (item, mchNo, res, mTR, VI, transId) {
	var timeNow = moment().format("HH:mm:ss")
	var dateNow = moment().format("DD/MM/YYYY")
	var transID = "'" + transId; 
	console.log(item)
	if (item.status == "SUCCESS") {
		console.log("check")
		var amountToPay = item.order.amount/100
		var status = item.status
		var remark = "NA"
		var method = item.method
		if (amountToPay <= 25) {
			if (VI[mchNo]) {
				if (VI[mchNo].active) {
					console.log("thanks")
					res.render('response', {text: "Thanks for using our service, please come again next time."});
					mymqtt.onMachine(mchNo,amountToPay)
					if (method == "WECHATPAY") {
						if (VI[mchNo].typeOfMachine == "detergent") {
							VI[mchNo].totalPaid = VI[mchNo].totalPaid + amountToPay
							VI[mchNo].wechatPaidtmp = VI[mchNo].wechatPaidtmp + amountToPay
							VI[mchNo].amountPaid = VI[mchNo].amountPaid + amountToPay
							//(mchNo, cp, wp, ep, mp, ap, tc, tw, te, tm, tp, type
							mymqtt.updateMoney(mchNo, 0, VI[mchNo].wechatPaidtmp, 0, 0, VI[mchNo].amountPaid, 0, 0, 0, 0, VI[mchNo].totalPaid, "detWechat")
							mymqtt.updateAccumulative(mchNo, "Wechat_received", amountToPay)
			            } else {
			                VI[mchNo].wechatPaid = VI[mchNo].wechatPaid + amountToPay
			                VI[mchNo].wechatPaidtmp = VI[mchNo].wechatPaidtmp + amountToPay
			                VI[mchNo].amountPaid = VI[mchNo].amountPaid + amountToPay
			                mymqtt.updateMoney(mchNo, 0, VI[mchNo].wechatPaid, 0, 0, VI[mchNo].amountPaid, 0, 0, 0, 0, 0, "Wechat")
			                mymqtt.updatetotal(mchNo, "wechatPaidtmp", VI[mchNo].wechatPaidtmp)
			            }
			        } else {
			        	if (VI[mchNo].typeOfMachine == "detergent") {
			                VI[mchNo].totalPaid = VI[mchNo].totalPaid + amountToPay
			                VI[mchNo].epayPaidtmp = VI[mchNo].epayPaidtmp + amountToPay
			                VI[mchNo].amountPaid = VI[mchNo].amountPaid + amountToPay
			                //(mchNo, cp, wp, ep, mp, ap, tc, tw, te, tm, tp, type)
			                mymqtt.updateMoney(mchNo, 0, 0, VI[mchNo].epayPaidtmp, 0, VI[mchNo].amountPaid, 0, 0, 0, 0, VI[mchNo].totalPaid, "detEpay")
			                mymqtt.updateAccumulative(mchNo, "Epay_received", amountToPay)
			            } else {
			                VI[mchNo].epayPaid = VI[mchNo].epayPaid + amountToPay
			                VI[mchNo].epayPaidtmp = VI[mchNo].epayPaidtmp + amountToPay
			                VI[mchNo].amountPaid = VI[mchNo].amountPaid + amountToPay
			                mymqtt.updateMoney(mchNo, 0, 0, VI[mchNo].epayPaid, 0, VI[mchNo].amountPaid, 0, 0, 0, 0, 0, "Epay")
			                mymqtt.updatetotal(mchNo, "epayPaidtmp", VI[mchNo].epayPaidtmp)
			            }
			        }
				} else {
					res.render('response', {text: "Sorry, This machine is not ready for Epayment right now. Please use another machine."});
					console.log(transId)
					status = "FULL_REFUNDED"
					remark = "Machine is not ready for epayment."
					rmapi.refundPayment(transId, item.order.amount, "The machine is not ready for Epayment right now.", "FULL")
				}
			} else {
				res.render('response', {text: "Sorry, This QR is not setup for our laundry service"});
				console.log(transId)
				status = "FULL_REFUNDED"
				remark = "QR not found"
				rmapi.refundPayment(transId, item.order.amount, "The QR is not setup for our laundry service", "FULL")
			}
        } else {
			res.render('response', {text:"The payment is too much"});
			status = "FAILED"
			remark = "The payment exceeded RM25";
			rmapi.refundPayment(transId, item.order.amount, "The payment might be too much, please redo your payment, Thanks.", "FULL")
		}
		rpting.createEntry(mchNo, method, transID, item.order.title, amountToPay, item.payee.userId, dateNow, timeNow, status, remark, mTR)
		rpting.save2csv("ePayment",mTR[transId], rpting.uploadNothing, reports_deposit_area)
	} else {
		res.render('response', {text:"Thanks"});
	}
	transIDdata[transId] = {};
	transIDdata[transId].done = "Yes";
	addTransId(transId);
	setTimeout(deleteTransID, 7200000, transId);
}


//rmapi.queryTrans("181114094527020013647579", render, res, varItem, myTransRecord)
//rmapi.refundPayment("181129092243020016602292", 100, "i just wanna refund", "FULL")
//rmapi.refundPayment("181128120537020014768951", 100, "i just wanna refund", "FULL")
//rmapi.refundPayment("181128120626020019928039", 100, "i just wanna refund", "FULL")
//rmapi.refundPayment("181128120626020019928039", 100, "i just wanna refund", "FULL")
//rmapi.refundPayment("181122104612020011063619", 200, "i just wanna refund", "FULL")

//rmapi.refundPayment("181118035946020019303470", 100, "i just wanna refund", "FULL")
//rmapi.refundPayment("181118040745020011695718", 200, "i just wanna refund", "FULL")
//rmapi.refundPayment("181114170041020011629414", 400, "i just wanna refund", "FULL")
//queryStore()
//////////////////////////////
///////// API ROUTE //////////
//////////////////////////////
function addTransId (id) {
	let db = new sqlite3.Database('./mydb/laundry.db', sqlite3.OPEN_READWRITE, (err) => {
		if (err) {
			console.error(err.message);
		}
		console.log('Connected to the laundry database.');
	});
	console.log("added transid "+id)
	//INSERT INTO users(username, password, status) VALUES(?,?,?)
	let sql = 'INSERT INTO transID(transid) VALUES(?)';
	let data = [id]
	db.run(sql, data, function(err, row) {
		if (err) {
			return console.error(err.message);
		}
	})
	db.close();
}

function deleteTransID(id) {
	delete transIDdata[id];
	console.log("deleted transid "+id)
	let db = new sqlite3.Database('./mydb/laundry.db', sqlite3.OPEN_READWRITE, (err) => {
		if (err) {
			console.error(err.message);
		}
		console.log('Connected to the laundry database.');
	});
	let sql = 'DELETE FROM transID WHERE transid = ?';
	db.run(sql, [id], function(err, row) {
		if (err) {
			return console.error(err.message);
		}
	})
}

app.get('/wechat/pay', function(req, res) {
	console.log("its been called")
	//console.log(req)
	//console.log(req.query)
	console.log(req.query.code + " and " + req.query.transactionId)
	var mchNo = req.query.code
	var tid = req.query.transactionId
	var myTransRecord = {}
	console.log(tid)
	if (transIDdata[tid].done == "Yes") {
		console.log("This transaction has been handled.")
	} else {
		rmapi.queryTrans(tid, render, res, varItem, myTransRecord, mchNo)
	}
	//res.status(200).send(req.body);
});

app.get('/fw/*', function(req, res) {
	//res.status(404).send('Unrecognised API call');
	var ip = req.connection.remoteAddress;
	  paperboy
	    .deliver(myWebroot, req, res)
	    .addHeader('Expires', 300)
	    .addHeader('X-PaperRoute', 'Node')
	    .before(function() {
		          console.log('Received Request');
	    })
	    .after(function(statCode) {
		          log(statCode, req.url, ip);
	    })
	    .error(function(statCode, msg) {
		          res.writeHead(statCode, {'Content-Type': 'text/plain'});
		          res.end("Error " + statCode);
		          log(statCode, req.url, ip, msg);
	    })
	    .otherwise(function(err) {
		          res.writeHead(404, {'Content-Type': 'text/plain'});
		          res.end("Error 404: File not found");
		          log(404, req.url, ip, err);
	    })
});


app.get('/',function(req,res) {
	//rmapi.queryTrans("181114094527020013647579", render, res, varItem, myTransRecord, "301b33a5742e1a5fc36a572f0126c245")
	res.render('index', {brand: outlet.brand, outlet: outlet.name, reply: "NA"});
})

app.post('/login_admin',function(req, res) {
	var username = req.body.username;
	var password = req.body.password;
	authenticate_admin(req, res, username, password);
});

app.post('/login_user',function(req, res) {
	var username = req.body.username;
	var password = req.body.password;
	authenticate_user(req, res, username, password);
});

app.post('/manualCut',function(req, res) {
	//console.log(req.body)
	const viCount = Object.keys(varItem).length;
	var myCutOffRecord = {}
	var count = 0;
	if (req.session && req.session.authenticated) {
		cutOffGroup[req.body.group].theStatus = "Submited"
		mymqtt.updateCutOffGrp(req.body.group, cutOffGroup[req.body.group].cutOffTime, "Submited")
		Object.keys(varItem).forEach(function(k) {
			count++;
			if (varItem[k].group == req.body.group) {
				var st = varItem[k].cutOffST;
				var mcN = varItem[k].machineName;
				cutOffTemp[st][k].submitBy = req.session.username
				cutOffTemp[st][k].calCoin = req.body[mcN]
				varItem[k].status = "Submited";
				mymqtt.updateCutOfftotal(k, "mystatus", varItem[k].status)
				if (varItem[k].typeOfMachine == "detergent") {
					cutOffTemp[st][k].calDet = req.body.det_rcv
					cutOffTemp[st][k].calSoft = req.body.soft_rcv
					cutOffTemp[st][k].calBeg = req.body.beg_rcv
					//(cutOffR, date, group, tc, cc, td, cd, ts, cs, tb, cb, st, et, cfby, smby)
					rpting.cutOffReportRecord(myCutOffRecord, st, mcN, cutOffTemp[st][k].cutOffTC, req.body[mcN], cutOffTemp[st][k].cutOffTD, req.body.det_rcv, cutOffTemp[st][k].cutOffTS, req.body.soft_rcv, cutOffTemp[st][k].cutOffTB, req.body.beg_rcv, cutOffTemp[st][k].lastCutoff, st, cutOffTemp[st][k].cutOffBy, cutOffTemp[st][k].submitBy)
					rpting.save2csv("manualCutOff",myCutOffRecord[mcN][st], rpting.uploadNothing, reports_deposit_area)
					delete cutOffTemp[st][k]
					if (isEmpty(cutOffTemp[st])) {
						delete cutOffTemp[st];
					}
				} else {
					rpting.cutOffReportRecord(myCutOffRecord, st, mcN, cutOffTemp[st][k].cutOffTC, req.body[mcN], 0, 0, 0, 0, 0, 0, cutOffTemp[st][k].lastCutoff, st, cutOffTemp[st][k].cutOffBy, cutOffTemp[st][k].submitBy)
					rpting.save2csv("manualCutOff",myCutOffRecord[mcN][st], rpting.uploadNothing, reports_deposit_area)
					delete cutOffTemp[st][k]
					if (isEmpty(cutOffTemp[st])) {
						delete cutOffTemp[st];
					}
				}
				console.log(myCutOffRecord[mcN][st])
			}
			if (count == viCount) {
				res.redirect('/manualCutOff')
			}
		})
	} else {
		res.redirect('/');
	}
});

function isEmpty(obj) {
    for(var key in obj) {
        if(obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

app.post('/wantCutOff', function(req, res) {
	var tempjs = [];
	const viCount = Object.keys(varItem).length;
	var count = 0;
	var vendt = false;
	if (req.session && req.session.authenticated) {
		if (cutOffGroup[req.body.group].theStatus == "CutOff" || cutOffGroup[req.body.group].theStatus == "NA" ) {
			Object.keys(varItem).forEach(function(k) {
				count++;
				if (varItem[k].group == req.body.group) {
					//console.log("matched")
					var machines = {};

					machines.name = varItem[k].machineName;
					tempjs.push(machines)
					if (varItem[k].typeOfMachine == "detergent") {
						vendt = true;
					}
				}
				if (count == viCount) {
						res.render('cutOffCounting', {grp: req.body.group, mchs: tempjs, cft: cutOffGroup[req.body.group].cutOffTime, vend: vendt})
				}
			})
		} else {
			res.redirect('/manualCutOff')
		}
	} else {
		res.redirect('/');
	}
})

app.post('/regroup', function(req, res) {
	const viCount = Object.keys(varItem).length;
	var count = 0;
	console.log(req.body)
	Object.keys(varItem).forEach(function(k) {
		count++;
		varItem[k].group = req.body[varItem[k].machineName];
		mymqtt.updatetotal(k, "mygroup", varItem[k].group)
		//varItem[k].cutOffST = cutOffGroup[req.body[varItem[k].machineName]].cutOffTime
		//varItem[k].status = cutOffGroup[req.body[varItem[k].machineName]].theStatus
		//mymqtt.updateCutOfftotal(k, "startTime", VI[mchNo].cutOffST)

		if (count == viCount) {
			res.redirect('/regroup')
		}
	})
})

app.get('/regroup', function(req, res) {
	if (req.session && req.session.authenticated) {
		var temp = []
		var groups = []
		const cfgCount = Object.keys(cutOffGroup).length;
		var count2 = 0;
		const viCount = Object.keys(varItem).length;
		var count = 0;
		Object.keys(cutOffGroup).forEach(function(g) {
			count2++;
			var mygroup = {}
			mygroup.group = g
			groups.push(mygroup);
			if (count2 == cfgCount) {
				Object.keys(varItem).forEach(function(k) {
					count++;
					var machines = {}
					var tmpgrp = []
					tmpgrp = Object.assign([], groups)
					for( var i = 0; i < tmpgrp.length; i++){ 
					   if ( tmpgrp[i].group === varItem[k].group) {
					   	//console.log(groups)
					    tmpgrp.splice(i, 1);
					   }
					}
					machines.machine = varItem[k].machineName
					machines.currGrp = varItem[k].group
					machines.grps = Object.assign([], tmpgrp)
					//console.log(machines)
					temp.push(machines)
					if (count == viCount) {
						res.render('regroup', {machines: temp})
					}
				})
			}
		})
	} else {
		res.redirect('/');
	}
})

app.get('/manageGroup', function(req, res) {
	const cfgCount = Object.keys(cutOffGroup).length;
	var count = 0;
	var groups = []
	if (req.session && req.session.authenticated) {
		Object.keys(cutOffGroup).forEach(function(g) {
			count++;
			var mygroup = {}
			mygroup.group = g
			groups.push(mygroup);
			if(count == cfgCount) {
				res.render('manageGroup', {grps: groups})
			}
		})
	} else {
		res.redirect('/');
	}
})

app.post('/deleteGroup', function(req, res) {
	const viCount = Object.keys(varItem).length;
	var count = 0;
	var exist = false;
	if (req.session && req.session.authenticated) {
		Object.keys(varItem).forEach(function(k) {
			count++;
			if (varItem[k].group == req.body.myGroup) {
				exist = true
			}
			if (count == viCount) {
				if (exist) {
					res.render('response', {text: "There are machines used this group, please change it to other group before you delete the group."});
				} else {
					delete cutOffGroup[req.body.myGroup];
					deleteGroup(req.body.myGroup)
					res.redirect('/manageGroup');
				}
			}
		})
	} else {
		res.redirect('/');
	}
})

app.post('/addGroup', function(req, res) {
	const viCount = Object.keys(varItem).length;
	var count = 0;
	var exist = false;
	if (req.session && req.session.authenticated) {
		if (cutOffGroup[req.body.newGrp]) {
			res.render('resManual', {text: "This group name was existed, please use another group name. Thanks."});
		} else {
			cutOffGroup[req.body.newGrp] = {};
			cutOffGroup[req.body.newGrp].MyGroup = req.body.newGrp;
			cutOffGroup[req.body.newGrp].cutOffTime = "NA"
			cutOffGroup[req.body.newGrp].theStatus = "Submited"
			addGroup(cutOffGroup[req.body.newGrp]);
			res.redirect('/manageGroup');
		}
	} else {
		res.redirect('/');
	}
})

app.get('/manualCutOff', function(req, res) {
	if (req.session && req.session.authenticated) {
		var items = {};
		var temp = [];
		var myItem = {};
		const viCount = Object.keys(varItem).length;
		var count = 0;
		Object.keys(varItem).forEach(function(k) {
			count++;
			//console.log(varItem[k].group)
			if (!items[varItem[k].group]) {
				items[varItem[k].group] = {}
				var tmp = {}
				items[varItem[k].group].group = varItem[k].group
				items[varItem[k].group].cutOfDate = cutOffGroup[varItem[k].group].cutOffTime
				items[varItem[k].group].mystatus = cutOffGroup[varItem[k].group].theStatus
				items[varItem[k].group].GroupedMachines = []
				tmp.machine = varItem[k].machineName
				items[varItem[k].group]["GroupedMachines"].push(tmp)
			} else {
				//console.log(varItem[k].machineName)
				var tmp = {}
				tmp.machine = varItem[k].machineName
				items[varItem[k].group]["GroupedMachines"].push(tmp)
			}
			if (count == viCount) {
				Object.keys(items).forEach(function(j) {
					temp.push(items[j]);
				})
			}
		})
		res.render('cutOffValue', {items: temp})
	}
})

app.get('/cutOffStatus', function(req, res) {
	if (req.session && req.session.authenticated) {
		var tmp = [];
		const viCount = Object.keys(varItem).length;
		var count = 0;
		Object.keys(varItem).forEach(function(k) {
			count++;
			var machines = {};
			machines.machine = varItem[k].machineName
			machines.startTime = varItem[k].cutOffST
			machines.status = varItem[k].status
			//console.log(machines)
			tmp.push(machines)
			if (count == viCount) {
				res.render('cutOffStatus', {machines: tmp})
			}
		})
	}
	else {
		res.redirect('/');
	}
}) 

app.post('/cutOffNow', function(req, res) {
	if (req.session && req.session.authenticated) {
		var timenow = moment().format("DD/MM/YYYY HH:mm:ss")
		const viCount = Object.keys(varItem).length;
		var count = 0;
		console.log(timenow)
		if (cutOffGroup[req.body.group].theStatus == "Submited" || cutOffGroup[req.body.group].theStatus == "NA" ) {
			cutOffGroup[req.body.group].theStatus = "CutOff"
			cutOffGroup[req.body.group].cutOffTime = timenow;
			mymqtt.updateCutOffGrp(req.body.group, timenow, "CutOff")
			Object.keys(varItem).forEach(function(k) {
				count++;
				if (varItem[k].group == req.body.group) {
					if (varItem[k].status == "Submited" || varItem[k].status == "NA" ) {
						if(!cutOffTemp[timenow]) {
							cutOffTemp[timenow] = {}
						}
						if(!cutOffTemp[timenow][k]) {
							cutOffTemp[timenow][k] = {};
						}
						cutOffTemp[timenow][k].cutOffBy = req.session.username
						cutOffTemp[timenow][k].cutOffTC = varItem[k].cutOffTC
						cutOffTemp[timenow][k].cutOffTD = varItem[k].cutOffTD
						cutOffTemp[timenow][k].cutOffTS = varItem[k].cutOffTS
						cutOffTemp[timenow][k].cutOffTB = varItem[k].cutOffTB
						cutOffTemp[timenow][k].lastCutoff = varItem[k].cutOffST
						varItem[k].cutOffTC = varItem[k].cutOffTD = varItem[k].cutOffTS = varItem[k].cutOffTB = 0
						varItem[k].status = "CutOff"
						varItem[k].cutOffST = timenow;
						//mchNo, stc, tc, std, td, stts, ts, stb, tb, st, lcft, sts, cfby
						mymqtt.updateCutOfftotalAll(k, cutOffTemp[timenow][k].cutOffTC, 0, cutOffTemp[timenow][k].cutOffTD, 0, cutOffTemp[timenow][k].cutOffTS, 0, cutOffTemp[timenow][k].cutOffTB, 0, timenow, cutOffTemp[timenow][k].lastCutoff, varItem[k].status, cutOffTemp[timenow][k].cutOffBy)
						//console.log(cutOffTemp[timenow][k])
					}
				}
				if (count == viCount) {
					res.redirect('/manualCutOff')
				}
			})
		} else {
			res.redirect('/manualCutOff')
		}
	} else {
		res.redirect('/');
	}
})

console.log(outlet.url)
app.get('/check_pricing', function(req, res){
	if (req.session && req.session.authenticated){
		var tmpdata = []
		var detData = []
		var dryData = []
		var hash = {}
		var detHash = {}
		var dryHash = {}
		//console.log(pricing_data)
		Object.keys(pricing_data).forEach(function(k){
			if (k.match(/kg/g)) {
				//console.log(k)
				if (k.match(/dry/g)) {
					var pattern = /[0-9]+kg/g
					var myType = "dryer_"+k.match(pattern)
					if (!dryHash[myType]) {
						dryHash[myType] = {}
						dryHash[myType].type = myType
					}
					if (pricing_data[k] != 0) {
						dryHash[myType].runTime = pricing_data[k]
						console.log(dryHash[myType])
						dryData.push(dryHash[myType])
					}
				} else {
					var pattern = /[0-9]+kg/g
					var myType = k.match(pattern)
					if (!hash[myType]) {
						hash[myType] = {}
						hash[myType].type = myType
					}
					if (pricing_data[k] != 0) {
						if (k.match(/cold/g)) {
							hash[myType].coldPrice = pricing_data[k]
						} else if (k.match(/warm/g)) {
							hash[myType].warmPrice = pricing_data[k]
						} else if (k.match(/hot/g)) {
							hash[myType].hotPrice = pricing_data[k]
						}
						if (hash[myType].coldPrice && hash[myType].warmPrice && hash[myType].hotPrice) {
							console.log(hash[myType])
							tmpdata.push(hash[myType])
						}
					}
				}
			} else if (k.match(/Price/g)) {
				if (!detHash.type) {
					detHash.type = "Vending"
				}
				if (k.match(/det/g)) {
					detHash.detPrice = pricing_data[k]
				} else if (k.match(/soft/g)) {
					detHash.softPrice = pricing_data[k]
				} else if (k.match(/beg/g)) {
					detHash.begPrice = pricing_data[k]
				}
				if (detHash.detPrice && detHash.softPrice && detHash.begPrice) {
					console.log(detHash)
					detData.push(detHash)
				}
			}
		})
		res.render('dashboard', {washers: tmpdata, vending: detData, dryer: dryData, brand: outlet.brand, outlet: outlet.name});
	} else {
		res.redirect('/');
	}
})



app.post('/update_price', function(req, res){
	if (req.session && req.session.authenticated && req.session.role == "admin"){
		var type = req.body.myType;
		console.log("its this type "+type)
		if(type == "Vending") {
			res.render('detPriceChange', {kgType: type, brand: outlet.brand, outlet: outlet.name})
		} else if (type.match(/dryer/g)) {
			res.render('dryPriceChange', {kgType: type, brand: outlet.brand, outlet: outlet.name})
		} else {
			res.render('priceChange', {kgType: type, brand: outlet.brand, outlet: outlet.name})
		}
		//res.render('thresholdChg_'+outlet.name, { users: data2.users, brand: outlet.brand, outlet: outlet.name});
	} else {
		res.redirect('/');
	}
})

app.get('/chgPassword_user', function(req, res){
	if (req.session && req.session.authenticated){
		res.render('chgPassword')
	} else {
		res.redirect('/');
	}
})		

app.get('/edit_user', function(req, res) {
	if (req.session && req.session.authenticated){
		if (req.session.role == "admin") {
			let db = new sqlite3.Database('./mydb/laundry.db', sqlite3.OPEN_READWRITE, (err) => {
				if (err) {
					console.error(err.message);
				}
				console.log('Connected to the laundry database.');
			});	
			db.serialize(function() {
				let sql = 'SELECT username us, Status status FROM users';
				db.all(sql, [], function(err, row) {
					res.render('editUser', {users: row, brand: outlet.brand, outlet: outlet.name});
				})
				
			})	
		} else {
			res.render('login_admin', {brand: outlet.brand, message: "You do not have permission to edit the users"})
		}
	} else {
		res.redirect('/');
	}
})

app.post('/delete_user', function(req, res) {
	let db = new sqlite3.Database('./mydb/laundry.db', sqlite3.OPEN_READWRITE, (err) => {
		if (err) {
			console.error(err.message);
		}
		console.log('Connected to the laundry database.');
	});	
	if (req.session && req.session.authenticated && req.session.role == "admin"){
		db.serialize(function() {
			let sql = 'DELETE FROM users WHERE username = ?';
			db.run(sql, [req.body.Username], function(err) {
				if (err) {
					return console.error(err.message);
				}
				//console.log("data deleted !!")
				res.redirect('/edit_user');
			})			
		})	
	} else {
		res.redirect('/');
	}
})

app.get('/admin_exec', function(req, res) {
	var tmpdata = []
	Object.keys(varItem).forEach(function(k){
		tmpdata.push(varItem[k])
	})
	res.render('admin_execution',{ url: outlet.url, machines: tmpdata, brand: outlet.brand, outlet: outlet.name});
})

app.get('/update_fw', function(req, res) {
	res.render('updateFw', { url: outlet.url, brand: outlet.brand, outlet: outlet.name});
})

app.get('/encrypt_pw', function(req, res) {
	res.render('encrypt_password',{ url: outlet.url, brand: outlet.brand, outlet: outlet.name});
})

app.get('/user_exec', function(req, res) {
	if (req.session && req.session.authenticated) {
		var tmpdata = []
		Object.keys(varItem).forEach(function(k){
			tmpdata.push(varItem[k])
		})
		res.render('execution',{ url: outlet.url, machines: tmpdata, brand: outlet.brand, outlet: outlet.name});
	} else {
		res.redirect('/');
	}
})

app.get('/stopMonitoring', function(req, res){
	if (req.session && req.session.authenticated){
		var tmpdata = []
		Object.keys(varItem).forEach(function(k){
			tmpdata.push(varItem[k])
		})
		res.render('systemHalt',{ url: outlet.url, machines: tmpdata, brand: outlet.brand, outlet: outlet.name});
	} else {
		res.redirect('/');
	}
})

app.post('/stopMonitor', function(req, res){
	var monitoringRecord = {}
	var timeNow = moment().format("DD/MM/YYYY HH:mm:ss")
	if (req.session && req.session.authenticated){
		console.log(req.body)
		//console.log(req.body.amount)
		var count = 0;
		var mchNo = "";
		var remark = "NA"
		const length = Object.keys(varItem).length;
		Object.keys(varItem).forEach(function(key) {
			if (varItem[key].machineName == req.body.mchName) {
				//console.log(key);''
				mchNo = key;
			}
			count++
			if (count == length) {
				if (!varItem[mchNo].active) {
					if(req.session.role == "admin") {
		            	res.render('resManualAdmin', {text: "The machine currently is not online. Please try again later."});
		            } else {
		            	res.render('resManual', {text: "The machine currently is not online. Please try again later."});
		            }
		        } else {
	        		varItem[mchNo].check = false;
	        		mymqtt.updatetotal(mchNo, "checking", varItem[mchNo].check)
	        		rpting.createMonReport(mchNo, varItem[mchNo].machineName, "Not Monitoring", timeNow, req.body.remark, req.session.username, monitoringRecord)
	        		rpting.save2csv("controlMon",monitoringRecord[mchNo], rpting.uploadNothing)
	        		var msg = "This machine "+varItem[mchNo].machineName+" has been stopped from monitoring."
					res.redirect('stopMonitoring')
		        }
				// rpting.recordMonitor(mchNo, "NA", transId, varItem[mchNo].machineName, req.body.amount, req.session.username , timeNow, status, remark, myTransRecord)
				// //rpting.save2csv("ePayment",myTransRecord[transId], rpting.uploadNothing)
				// rpting.save2csv("manualPay",myTransRecord[transId], rpting.uploadNothing, reports_deposit_area)
				//res.status(200).send("paid")
			}
		})
	} else {
		res.redirect('/');
	}
})

app.post('/startMonitor', function(req, res){
	var monitoringRecord = {}
	var timeNow = moment().format("DD/MM/YYYY HH:mm:ss")
	if (req.session && req.session.authenticated){
		console.log(req.body)
		//console.log(req.body.amount)
		var count = 0;
		var mchNo = "";
		var remark = "NA"
		const length = Object.keys(varItem).length;
		Object.keys(varItem).forEach(function(key) {
			if (varItem[key].machineName == req.body.mchName) {
				//console.log(key);''
				mchNo = key;
			}
			count++
			if (count == length) {
				if (!varItem[mchNo].active) {
					if(req.session.role == "admin") {
		            	res.render('resManualAdmin', {text: "The machine currently is not online. Please try again later."});
		            } else {
		            	res.render('resManual', {text: "The machine currently is not online. Please try again later."});
		            }
		        } else {
	        		if(varItem[mchNo].check == false) {
	        			varItem[mchNo].check = true;
	        			mymqtt.updatetotal(mchNo, "checking", varItem[mchNo].check)
	        			//createMonReport = function (mchCode, title, sts, time, remark, user,cMR){
	        			rpting.createMonReport(mchNo, varItem[mchNo].machineName, "Monitoring", timeNow, req.body.remark, req.session.username, monitoringRecord)
	        			rpting.save2csv("controlMon",monitoringRecord[mchNo], rpting.uploadNothing)
	        			var msg = "This machine "+varItem[mchNo].machineName+" is under monitoring now."
	        		} else {
	        			var msg = "This machine "+varItem[mchNo].machineName+" is already under monitoring now."
	        		}
					if(req.session.role == "admin") {
						res.render('resManualAdmin', {text: msg});
					} else {
						res.render('resManual', {text: msg});
					}
		        }
				// rpting.recordMonitor(mchNo, "NA", transId, varItem[mchNo].machineName, req.body.amount, req.session.username , timeNow, status, remark, myTransRecord)
				// //rpting.save2csv("ePayment",myTransRecord[transId], rpting.uploadNothing)
				// rpting.save2csv("manualPay",myTransRecord[transId], rpting.uploadNothing, reports_deposit_area)
				//res.status(200).send("paid")
			}
		})
	} else {
		res.redirect('/');
	}
})

app.post('/active_user', function(req, res) {
	let db = new sqlite3.Database('./mydb/laundry.db', sqlite3.OPEN_READWRITE, (err) => {
		if (err) {
			console.error(err.message);
		}
		console.log('Connected to the laundry database.');
	});	
	if (req.session && req.session.authenticated && req.session.role == "admin"){
		db.serialize(function() {
			let sql = 'UPDATE users SET status = ? WHERE username = ?';
			db.run(sql, ["Active", req.body.Username], function(err) {
				if (err) {
					return console.error(err.message);
				}
				res.redirect('/edit_user');
			})
		})
	} else {
		res.redirect('/');
	}
})

app.post('/deactive_user', function(req, res) {
	let db = new sqlite3.Database('./mydb/laundry.db', sqlite3.OPEN_READWRITE, (err) => {
		if (err) {
			console.error(err.message);
		}
		console.log('Connected to the laundry database.');
	});	
	if (req.session && req.session.authenticated && req.session.role == "admin"){
		db.serialize(function() {
			let sql = 'UPDATE users SET status = ? WHERE username = ?';
			db.run(sql, ["Inactive", req.body.Username], function(err) {
				if (err) {
					return console.error(err.message);
				}
				res.redirect('/edit_user');
			})
		})
	} else {
		res.redirect('/');
	}
})

app.post('/deactive_user', function(req, res) {
	let db = new sqlite3.Database('./mydb/laundry.db', sqlite3.OPEN_READWRITE, (err) => {
		if (err) {
			console.error(err.message);
		}
		console.log('Connected to the laundry database.');
	});	
	if (req.session && req.session.authenticated && req.session.role == "admin"){
		db.serialize(function() {
			let sql = 'UPDATE users SET status = ? WHERE username = ?';
			db.run(sql, ["Inactive", req.body.Username], function(err) {
				if (err) {
					return console.error(err.message);
				}
				res.redirect('/edit_user');
			})
		})
	} else {
		res.redirect('/');
	}
})

app.post('/register_user', function(req, res) {
	let db = new sqlite3.Database('./mydb/laundry.db', sqlite3.OPEN_READWRITE, (err) => {
		if (err) {
			console.error(err.message);
		}
		console.log('Connected to the laundry database.');
	});	
	db.serialize(function() {
		let sql = 'INSERT INTO users(username, password, status) VALUES(?,?,?)';
		var password_md5 = crypto.createHash('md5').update(req.body.password).digest('hex');
		db.run(sql, [req.body.username, password_md5, "Inactive"], function(err) {
			if (err) {
				return console.error(err.message);
			}
			res.render('index', {brand: outlet.brand, outlet: outlet.name, reply: "NA"})
		})
	})
})
app.get('/chg_password_admin', function(req, res){
	if (req.session && req.session.authenticated && req.session.role == "admin"){
		res.render('chgPassword_admin')
	} else {
		res.redirect('/');
	}
})		

app.get('/chg_password_user', function(req, res){
	if (req.session && req.session.authenticated){
		res.render('chgPassword')
	} else {
		res.redirect('/');
	}
})		

app.post('/chg_password_user', function(req, res) {
	if (req.session && req.session.authenticated){
		let db = new sqlite3.Database('./mydb/laundry.db', sqlite3.OPEN_READWRITE, (err) => {
			if (err) {
				console.error(err.message);
			}
			console.log('Connected to the laundry database.');
		});	
		db.serialize(function() {
			let sql = 'SELECT password pw FROM users WHERE username = ?';
			//console.log(req.session.username)
			db.get(sql, [req.session.username], function(err, row) {
				console.log(row)
				var oripassword_md5 = crypto.createHash('md5').update(req.body.oripassword).digest('hex');
                var newpassword_md5 = crypto.createHash('md5').update(req.body.newpassword).digest('hex');
				if(oripassword_md5 == row.pw) {
					let sql2 = 'UPDATE users SET password = ? WHERE username = ?';
					db.run(sql2, [newpassword_md5, req.session.username], function(err) {
						if (err) {
							return console.error(err.message);
						}
						res.render('index', {brand: outlet.brand, outlet: outlet.name, reply: "NA"})
					})
				} else {
					res.render('response', {text: "The original password key in is incorrect!"});
				}
			})
		})
	} else {
		res.redirect('/');
	}
})

app.post('/chg_password_admin', function(req, res) {
	if (req.session && req.session.authenticated && req.session.role == "admin"){
		let db = new sqlite3.Database('./mydb/laundry.db', sqlite3.OPEN_READWRITE, (err) => {
			if (err) {
				console.error(err.message);
			}
			console.log('Connected to the laundry database.');
		});	
		db.serialize(function() {
			let sql = 'SELECT password pw FROM admin WHERE username = ?';
			//console.log(req.session.username)
			db.get(sql, [req.session.username], function(err, row) {
				console.log(row)
				var oripassword_md5 = crypto.createHash('md5').update(req.body.oripassword).digest('hex');
                var newpassword_md5 = crypto.createHash('md5').update(req.body.newpassword).digest('hex');
				if(oripassword_md5 == row.pw) {
					let sql2 = 'UPDATE admin SET password = ? WHERE username = ?';
					db.run(sql2, [newpassword_md5, req.session.username], function(err) {
						if (err) {
							return console.error(err.message);
						}
						res.render('index', {brand: outlet.brand, outlet: outlet.name, reply: "NA"})
					})
				} else {
					res.render('response', {text: "The original password key in is incorrect!"});
				}
			})
		})
	} else {
		res.redirect('/');
	}
})

app.post('/encrypt_pw_md5', function(req, res) {
	if (req.session && req.session.authenticated){
		let db = new sqlite3.Database('./mydb/laundry.db', sqlite3.OPEN_READWRITE, (err) => {
			if (err) {
				console.error(err.message);
			}
			console.log('Connected to the laundry database.');
		});	
		db.serialize(function() {
			let sql = 'SELECT * FROM users';
            let sql_admin = 'SELECT * FROM admin';
			//console.log(req.session.username)
			db.all(sql, function(err, rows) {
                rows.forEach(function(row){
                    //console.log(row);
                    if(row.password.length != 32){
                        var username = row.username;
                        var password = row.password;
                        var password_md5 = crypto.createHash('md5').update(password).digest('hex');
                        
                        let sql2 = 'UPDATE users SET password = ? WHERE username = ?';
                        db.run(sql2, [password_md5, username], function(err) {
                            if (err) {
                                return console.error(err.message);
                            }
                        })
                    } else{
                        console.log("skip");
                    }
                });
                console.log("Password Encryped!");
			})
            db.all(sql_admin, function(err, rows) {
                rows.forEach(function(row){
                    //console.log(row);
                    if(row.password.length != 32){
                        var username = row.username;
                        var password = row.password;
                        var password_md5 = crypto.createHash('md5').update(password).digest('hex');
                        
                        let sql_admin2 = 'UPDATE admin SET password = ? WHERE username = ?';
                        db.run(sql_admin2, [password_md5, username], function(err) {
                            if (err) {
                                return console.error(err.message);
                            }
                        })
                    } else{
                        console.log("skip");
                    }
                });
                console.log("Password Encryped!");
			})
            res.redirect('update_fw');
		})
	} else {
		res.redirect('/');
	}
})

app.post('/manual_turnOn', function(req, res){
	var timeNow = moment().format("HH:mm:ss")
	var dateNow = moment().format("DD/MM/YYYY")
	var manualPayRecord = {}
	if (req.session && req.session.authenticated){
		//console.log(req.body.mchName)
		//console.log(req.body.amount)
		var count = 0;
		var mchNo = "";
		var transId = "'" + rmapi.makeid();
		var remark = "NA"
		const length = Object.keys(varItem).length;
		Object.keys(varItem).forEach(function(key) {
			if (varItem[key].machineName == req.body.mchName) {
				//console.log(key);''
				mchNo = key;
			}
			count++
			if (count == length) {
				var status = "MANUAL";
				console.log(mchNo)
				if (varItem[mchNo].active) {
					if(req.session.role == "admin") {
		            	res.render('resManualAdmin', {text: "The manual payment is done!"});
		            } else {
		            	res.render('resManual', {text: "The manual payment is done!"});
		            }
		            var amount  = parseInt(req.body.amount)
		            mymqtt.onMachine(mchNo,amount)
					if (varItem[mchNo].typeOfMachine == "detergent") {
						varItem[mchNo].manualPaidtmp = varItem[mchNo].manualPaidtmp + amount
						//(mchNo, cp, wp, ep, mp, ap, tc, tw, te, tm, tp, type)
						mymqtt.updateAccumulative(mchNo, "Manual_payment", amount)
						mymqtt.updatetotal(mchNo, "manualPaidtmp", varItem[mchNo].manualPaidtmp)
		            } else {
						varItem[mchNo].manualPaid = varItem[mchNo].manualPaid + amount
		            	varItem[mchNo].manualPaidtmp = varItem[mchNo].manualPaidtmp + amount
		                mymqtt.updateMoney(mchNo, 0, 0, 0, varItem[mchNo].manualPaid, 0, 0, 0, 0, 0, 0, "Manual")
		                mymqtt.updatetotal(mchNo, "manualPaidtmp", varItem[mchNo].manualPaidtmp)
		                remark = req.body.remark
		            }
		        } else {
					if(req.session.role == "admin") {
						res.render('resManualAdmin', {text: "Sorry, This machine is not online for Manual Payment. Please try again later."});
					} else {
						res.render('resManual', {text: "Sorry, This machine is not online for Manual Payment. Please try again later."});
					}
					status = "FAILED"
					remark = "Machine not online, manual payment cannot be done."
		        }
				rpting.createEntry(mchNo, "NA", transId, varItem[mchNo].machineName, req.body.amount, req.session.username , dateNow, timeNow, status, remark, manualPayRecord)
				//rpting.save2csv("ePayment",myTransRecord[transId], rpting.uploadNothing)
				rpting.save2csv("manualPay",manualPayRecord[transId], rpting.uploadNothing, reports_deposit_area)
				//res.status(200).send("paid")
			}
		})
	} else {
		res.redirect('/');
	}
})

app.post('/update_pricing', function(req, res) {
	//console.log(req.body)
	var cold = "cold"+req.body.myType
	var warm = "warm"+req.body.myType
	var hot = "hot"+req.body.myType
	if (req.session && req.session.authenticated){
		let db = new sqlite3.Database('./mydb/laundry.db', sqlite3.OPEN_READWRITE, (err) => {
	  		if (err) {
	    		console.error(err.message);
	  		}
	  		//console.log('Connected to the laundry database.');
		});
		if(req.body.myType == "Vending") {
			db.serialize(function() {
				pricing_data["detPrice"] = req.body.detPrice
				let data = [req.body.detPrice, outlet.name];
				let sql = 'UPDATE pricing SET detPrice = ? WHERE outlet = ?';
				db.run(sql, data, function(err) {
					if (err) {
						return console.error(err.message);
					}
					//console.log("data has been updated")
				})
				pricing_data["softPrice"] = req.body.softPrice
				let data2 = [req.body.softPrice, outlet.name];
				let sql2 = 'UPDATE pricing SET softPrice = ? WHERE outlet = ?';
				db.run(sql2, data2, function(err) {
					if (err) {
						return console.error(err.message);
					}
					//console.log("data has been updated")
				})
				pricing_data["begPrice"] = req.body.begPrice
				let data3 = [req.body.begPrice, outlet.name];
				let sql3 = 'UPDATE pricing SET begPrice = ? WHERE outlet = ?';
				db.run(sql3, data3, function(err) {
					if (err) {
						return console.error(err.message);
					}
					//console.log("data has been updated")
				})
				db.close();
				res.redirect('/check_pricing')
			})
		} else if (req.body.myType.match(/dryer/g)) {
			db.serialize(function() {
				var pattern = /[0-9]+kg/g
				var kg = "dry"+req.body.myType.match(pattern) 
				let data = [req.body.price, outlet.name];
				let sql = 'UPDATE pricing SET '+kg+' = ? WHERE outlet = ?';
				db.run(sql, data, function(err) {
					if (err) {
						return console.error(err.message);
					}
					//console.log("data has been updated")
				})
				pricing_data[kg] = req.body.price
				db.close();
				res.redirect('/check_pricing')
			})
		} else {
			db.serialize(function() {
				pricing_data[cold] = req.body.cold
				let data = [req.body.cold, outlet.name];
				let sql = 'UPDATE pricing SET '+cold+' = ? WHERE outlet = ?';
				db.run(sql, data, function(err) {
					if (err) {
						return console.error(err.message);
					}
					//console.log("data has been updated")
				})
				pricing_data[warm] = req.body.warm
				let data2 = [req.body.warm, outlet.name];
				let sql2 = 'UPDATE pricing SET '+warm+' = ? WHERE outlet = ?';
				db.run(sql2, data2, function(err) {
					if (err) {
						return console.error(err.message);
					}
					//console.log("data has been updated")
				})
				pricing_data[hot] = req.body.hot
				let data3 = [req.body.hot, outlet.name];
				let sql3 = 'UPDATE pricing SET '+hot+' = ? WHERE outlet = ?';
				db.run(sql3, data3, function(err) {
					if (err) {
						return console.error(err.message);
					}
					//console.log("data has been updated")
				})
				db.close();
				res.redirect('/check_pricing')
			})
		}
		//res.status(200).send("The pricing has been changed to cold " + coldRun + " warm " + warmRun + " hot " + hotRun);
	} else {
		res.redirect('/');
	}
});

app.get('/logout', function(req, res, next) {
	  if (req.session) {
		req.session.destroy(function(err) {
			if(err) {
				return next(err);
			} else {
			        return res.redirect('/');
			}
	  	});
	  }
});

app.get('/register', function(req, res) {
	res.render('registerUser');
})

app.get('/thanks', function(req, res) {
	res.render('response', {text: "Thanks for using our service. Please come back again.", brand: outlet.brand});
});

app.get('/update_firmware', function(req, res) {
	if (req.session && req.session.authenticated){
		console.log("firmware update triggered")
		mymqtt.mqttC.publish("firmwareUpdate", "update")
		res.status(200).send("the firmware is updating");
	} else {
		res.redirect('/');
	}
});


function log(statCode, url, ip, err) {
	var logStr = statCode + ' - ' + url + ' - ' + ip;
	if (err)
		logStr += ' - ' + err;
		console.log(logStr);
}
// github webhook for the main script repo
app.post("/webhooks/github", function (req, res) {
        var sender = req.body.sender;
        var branch = req.body.ref;
        console.log("The files in the repo has been changed")
        if(branch.indexOf('master') > -1 && sender.login === githubUsername){
            res.status(200).send('OK');
            deploy(res);
        }
})

// github webhook for the misc repo 
app.post("/webhooks/misc", function (req, res) {
        var sender = req.body.sender;
        var branch = req.body.ref;
        console.log("The files in the repo has been changed")
        if(branch.indexOf('master') > -1 && sender.login === githubUsername){
            res.status(200).send('OK');
            transMisc(res);
        }
})

app.post('/pingme', function(req,res) {
	if (req.body.Online == "Yes") {
    	console.log("Its been called by Pinger")
		if (outlet.name == "SP" || outlet.name == "PJ21") {
			noPing = 0;
			clearTimeout(timeoutHandle);
			timeoutHandle = setTimeout(dropped, 360000);
		}
	}
	var msg = {"status": "Online"};
	res.send(msg)
})

function dropped() {
	noPing = 1;
}

function deploy(res){
    childProcess.exec('cd /home/pi && ./deploy.sh', function(err, stdout, stderr){
        if (err) {
                console.error(err);
                //return res.status(500).send('Internal Server Error');
        }
	//return res.status(200).send('OK');
    });
}

function resetTux() {
    childProcess.exec('sudo supervisorctl restart tuxtunnel', function(err, stdout, stderr){
        if (err) {
                console.error(err);
        }
    });
}

function transMisc(res){
    childProcess.exec('cd /home/pi/mylaundry/misc/'+outlet.name.toLowerCase()+' && ../trans.sh', function(err, stdout, stderr){
        if (err) {
                console.error(err);
                //return res.status(500).send('Internal Server Error');
        }
        //return res.status(200).send('OK');
    });
}

function backupReports(){
	var today = moment().format("DD_MM_YYYY");
	var S7daysAgo = moment().subtract(7,'days').format("DD_MM_YYYY")
	var todayReportPath = "backup/"+today;
	var oldReportPath = "backup/"+S7daysAgo;
	var backupFolder = "backup"
	if (!fs.existsSync(backupFolder)) {
		childProcess.exec('mkdir backup', function(err, stdout, stderr){
		    if (err) {
		            console.error(err);
		            //return res.status(500).send('Internal Server Error');
		    }
		    console.log("Create backup folder")
		    //return res.status(200).send('OK');
		});
	}
	if (!fs.existsSync(todayReportPath)) {
		childProcess.exec('mkdir backup/'+today+' && cp -f -r reports backup/'+today, function(err, stdout, stderr){
		    if (err) {
		            console.error(err);
		            //return res.status(500).send('Internal Server Error');
		    }
		    console.log("Backup the reports")
		    //return res.status(200).send('OK');
		});
	}
    if (fs.existsSync(oldReportPath)) {
    	childProcess.exec('rm -f -r backup/'+S7daysAgo, function(err, stdout, stderr){
		    if (err) {
		            console.error(err);
		            //return res.status(500).send('Internal Server Error');
		    }
		    console.log("Deleted reports on 7 days ago " + S7daysAgo);
		    //return res.status(200).send('OK');
		});
	}
}

function backupMonthlyReport(){
	var lastMonth = moment().subtract(1,'days').format("MMMM");
	var thisYear = moment().format("YYYY");
	var yearEnd = false;
	var ytdYear = moment().subtract(1,'days').format("YYYY");
	if (ytdYear != thisYear) {
		thisYear = ytdYear
		yearEnd = true;
	}
	var thisMonthReportPath = "backup/"+ thisYear+'/'+lastMonth;
	var backupFolder = "backup"
	var thisYearFolder = "backup/"+ thisYear;
	if (!fs.existsSync(backupFolder)) {
		childProcess.exec('mkdir backup', function(err, stdout, stderr){
		    if (err) {
		            console.error(err);
		            //return res.status(500).send('Internal Server Error');
		    }
		    console.log("Creating backup folder")
		    //return res.status(200).send('OK');
		});
	}
	if (!fs.existsSync(thisYearFolder) && !yearEnd) {
		childProcess.exec('mkdir '+thisYearFolder+ ' && cp -f reports/*'+thisYear+'* '+ thisYearFolder, function(err, stdout, stderr){
		    if (err) {
		            console.error(err);
		            //return res.status(500).send('Internal Server Error');
		    }
		    console.log("Create this Year folder and Copy Yearly reports")
		    //return res.status(200).send('OK');
		});
	} else if (fs.existsSync(thisYearFolder) && !yearEnd) {
		childProcess.exec('cp -f reports/*'+thisYear+'* '+ thisYearFolder, function(err, stdout, stderr){
		    if (err) {
		            console.error(err);
		            //return res.status(500).send('Internal Server Error');
		    }
		    console.log("Copy Yearly Reports")
		    //return res.status(200).send('OK');
		});
	} else if (fs.existsSync(thisYearFolder) && yearEnd) {
		childProcess.exec('mv -f reports/*'+thisYear+'* '+ thisYearFolder, function(err, stdout, stderr){
		    if (err) {
		            console.error(err);
		            //return res.status(500).send('Internal Server Error');
		    }
		    console.log("Move Yearly Reports")
		    //return res.status(200).send('OK');
		});
	}
	if (!fs.existsSync(thisMonthReportPath)) {
		childProcess.exec('mkdir '+thisMonthReportPath+' && mv -f reports/*'+lastMonth+'* '+thisMonthReportPath, function(err, stdout, stderr){
		    if (err) {
		            console.error(err);
		            //return res.status(500).send('Internal Server Error');
		    }
		    console.log("Backup monthly reports")
		    //return res.status(200).send('OK');
		});
	}
}

function checkFlag() {
    if(!noPing) {
    	if (doneReset == 1) {
    		var mailOptions = {
		        from: outlet.email,
		        to: 'jamesleesukey@gmail.com',
		        subject: 'The server is up now - ' + outlet.name ,
		        text: outlet.name + ' is up now after reseted the tux tunnel for dataplicity'
		 	};
		 	transporter.sendMail(mailOptions, function(error, info){
		        if (error) {
		            console.log(error);
		        } else {
		            console.log('Email sent: ' + info.response);
		        }
		 	});
		}
     doneReset = 0;
     setTimeout(checkFlag, 60000); 
    } else {
      if (doneReset == 1) {
      } else {
      	resetTux();
      	doneReset = 1;
      	var mailOptions = {
            from: outlet.email,
            to: 'jamesleesukey@gmail.com',
            subject: 'The server is down, reseted the tux tunnel' + outlet.name ,
            text: 'The tux tunnel for ' + outlet.name + ' is reseted, please check the server is up now.'
     	};
     	transporter.sendMail(mailOptions, function(error, info) {
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
     	});
      }
      setTimeout(checkFlag, 60000);
    }
}

//app.listen(80);
server.listen(80);
console.log('App Server running at port 80');
