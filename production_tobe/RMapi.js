var fs = require('fs');
var base64 =  require('base-64');
var crypto = require('crypto');
var fetch = require('node-fetch');
const outlet = require('../data/outlet.js')
var moment = require('moment');

var myToken
var expired = 7100;
var myRefreshToken
var myItem
var mySign

module.exports.getPrivateKeySomehow = function() {
	var privKey = fs.readFileSync('./credentials/private_key.pem', 'utf8');
	//console.log(">>> Private key: \n\n" + privKey);
	return privKey;
}
module.exports.getSignature = function(data) {
	var privateKey = getPrivateKeySomehow();
	var sign = crypto.createSign("sha256");
	sign.update(data);
	var signature = sign.sign(privateKey);
	const signature_hex = signature.toString('base64')
	console.log(">>> Signature:\n\n" + signature_hex);
	return signature;
}



module.exports.requestToken = function() {
	var clientID = outlet.clientID
	var clientSecret = outlet.clientSecret
	var credential_req = {"grantType": "client_credentials"} 
	var credential_head = {"Authorization": "Basic " + base64.encode(clientID + ":" + clientSecret), "Content-Type":"application/json"}
 	return fetch('https://oauth.revenuemonster.my/v1/token',
			{headers: credential_head,
			method:'POST',
			body:JSON.stringify(credential_req)
		}).then(res => res.json())
		.catch(error => console.error('Error:', error))
		.then(response => {
			//console.log('Success:', response)
			myToken = response.accessToken
			myRefreshToken = response.refreshToken
		})
}
var test = 1542248658459
const formatted = moment(test).format("DD/MM/YYYY HH:mm:ss");
console.log(formatted);


module.exports.refreshToken = function() {
	var clientID = outlet.clientID
	var clientSecret = outlet.clientSecret
	var credential_req = {"grantType": "refresh_token", "refreshToken": myRefreshToken} 
	var credential_head = {"Authorization": "Basic " + base64.encode(clientID + ":" + clientSecret), "Content-Type":"application/json"}
	return 	fetch('https://oauth.revenuemonster.my/v1/token',
			{headers: credential_head,
			method:'POST',
			body:JSON.stringify(credential_req)
		}).then(res => res.json())
		.catch(error => console.error('Error:', error))
		.then(response => {
			//console.log('Success refresh token:', response)
			myToken = response.accessToken
			myRefreshToken = response.refreshToken
		})
}

module.exports.makeid = function() {
	    var text = "";
	    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
	    for(var i = 0; i < 32; i++) {
		            text += possible.charAt(Math.floor(Math.random() * possible.length));
		        }
	    return text;
}

module.exports.generateSign = function(data, method, noncestr, privateKey, requestUrl, signtype, time) {
	var otStr = exports.makeid()	
	var mydata = {"data": data, "method": method, "nonceStr":noncestr,
		   "privateKey": privateKey,"requestUrl": requestUrl,
		    "signType": signtype, "timestamp":time}
	//console.log(mydata)
	//console.log("testgen")
	return 	fetch('https://open.revenuemonster.my/tool/signature/generate',
			{headers: {"Content-Type":"application/json"},
			method:'POST',
			body:JSON.stringify(mydata)
		}).then(res => res.json())
		.catch(error => console.error('Error:', error))
		.then(response => {
			//console.log('Success:', response)
			mySign = response.signature
			//process.env.DATA = response.data
			//console.log(process.env.SIG + process.env.DATA)
		})	
}

module.exports.queryTrans = function(transId, callback, res, vi, mtr, mchNo) {
	var method = "get"
	var signtype = "sha256"
	var myurl = "https://open.revenuemonster.my/v3/payment/transaction/" + transId
	var time = Math.floor(Date.now()/1000)
	var time_str = time.toString()
	var otStr = exports.makeid()
	var priv_key = exports.getPrivateKeySomehow()
	var data = {
	//	"transactionId":transId
	}
	if (myToken == undefined) {
		return exports.requestToken().then(function(){
			//console.log("token is expired "+ expired)
			setInterval(exports.refreshToken,expired*1000)
			//console.log(myToken)
			return exports.generateSign(data, method, otStr, priv_key, myurl, signtype, time_str).then(function(){
				var header = {"Authorization":"Bearer " + myToken, "Content-Type":"application/json", "X-Nonce-Str":otStr, "X-Signature":mySign, "X-Timestamp":time_str}
 				console.log(header)	
				return	fetch(myurl, {
					headers:header,
					method:'GET'
				}).then(res => res.json())
				.catch(error => console.error('Error:', error))
				.then(response => {
					console.log('Success:', response.item)
					callback(response.item, mchNo, res, mtr, vi, transId)
					//exports.myItem = myItem
					//console.log(mi)
				})
			})
		})
	} else {
		//console.log("already have token")
		return 	exports.generateSign(data, method, otStr, priv_key, myurl, signtype, time_str).then(function(){
			var header = {"Authorization":"Bearer " + myToken, "Content-Type":"application/json", "X-Nonce-Str":otStr, "X-Signature":mySign, "X-Timestamp":time_str}
 			//console.log(header)	
			return	fetch(myurl, {
				headers:header,
				method:'GET'
			}).then(res => res.json())
			.catch(error => console.error('Error:', error))
			.then(response => {
				console.log('Success:', response)
				callback(response.item, mchNo, res, mtr, vi, transId)
			})
		})
	}
		
}

module.exports.queryQRcodes = function() {
	var method = "get"
	var signtype = "sha256"
	var myurl = "https://open.revenuemonster.my/v3/payment/transaction/qrcodes"
	var time = Math.floor(Date.now()/1000)
	var time_str = time.toString()
	var otStr = exports.makeid()
	var priv_key = exports.getPrivateKeySomehow()
	var data = {
	//	"transactionId":transId
	}
	if (myToken == undefined) {
		return exports.requestToken().then(function(){
			//console.log("token is expired "+ expired)
			setInterval(exports.refreshToken,expired*1000)
			//console.log(myToken)
			return exports.generateSign(data, method, otStr, priv_key, myurl, signtype, time_str).then(function(){
				var header = {"Authorization":"Bearer " + myToken, "Content-Type":"application/json", "X-Nonce-Str":otStr, "X-Signature":mySign, "X-Timestamp":time_str}
 				console.log(header)	
				return	fetch(myurl, {
					headers:header,
					method:'GET'
				}).then(res => res.json())
				.catch(error => console.error('Error:', error))
				.then(response => {
					console.log('Success:', response)
					//callback(response.item, mchNo, res, mtr, vi, transId)
					//exports.myItem = myItem
					//console.log(mi)
				})
			})
		})
	} else {
		//console.log("already have token")
		return 	exports.generateSign(data, method, otStr, priv_key, myurl, signtype, time_str).then(function(){
			var header = {"Authorization":"Bearer " + myToken, "Content-Type":"application/json", "X-Nonce-Str":otStr, "X-Signature":mySign, "X-Timestamp":time_str}
 			//console.log(header)	
			return	fetch(myurl, {
				headers:header,
				method:'GET'
			}).then(res => res.json())
			.catch(error => console.error('Error:', error))
			.then(response => {
				console.log('Success:', response)
				//callback(response.item, mchNo, res, mtr, vi, transId)
			})
		})
	}
		
}



module.exports.queryProfile = function() {
	var method = "get"
	var signtype = "sha256"
	var myurl = "https://open.revenuemonster.my/v3/user"
	var time = Math.floor(Date.now()/1000)
	var time_str = time.toString()
	var otStr = exports.makeid()
	var priv_key = exports.getPrivateKeySomehow()
	var data = {}
	var jsondata = JSON.stringify(data)
	if (myToken == undefined) {
		return exports.requestToken().then(function(){
			return exports.generateSign(data, method, otStr, priv_key, myurl, signtype, time_str).then(function(){
				var header = {"Authorization":"Bearer " + myToken, "Content-Type":"application/json", "X-Nonce-Str":otStr, "X-Signature":mySign, "X-Timestamp":time_str}
 				//console.log(header)	
				return fetch('https://open.revenuemonster.my/v3/user', {
					headers:header,
					method:'GET'
				}).then(res => res.json())
				.catch(error => console.error('Error:', error))
				.then(response => {
					//console.log('Success:', response)
				})
				})
		})
	} else {
		return exports.generateSign(data, method, otStr, priv_key, myurl, signtype, time_str).then(function(){
				var header = {"Authorization":"Bearer " + myToken, "Content-Type":"application/json", "X-Nonce-Str":otStr, "X-Signature":mySign, "X-Timestamp":time_str}
 				//console.log(header)	
				return 	fetch('https://open.revenuemonster.my/v3/user', {
						headers:header,
						method:'GET'
					}).then(res => res.json())
					.catch(error => console.error('Error:', error))
					.then(response => {
						//console.log('Success:', response)
					})
		})
	}
}

module.exports.queryStore = function() {
	var method = "get"
	var signtype = "sha256"
	var myurl = "https://open.revenuemonster.my/v3/stores"
	var time = Math.floor(Date.now()/1000)
	var time_str = time.toString()
	var otStr = exports.makeid()
	var priv_key = exports.getPrivateKeySomehow()
	var data = {}
	var jsondata = JSON.stringify(data)
	if (myToken == undefined) {
		return exports.requestToken().then(function(){
			return exports.generateSign(data, method, otStr, priv_key, myurl, signtype, time_str).then(function(){
				var header = {"Authorization":"Bearer " + myToken, "Content-Type":"application/json", "X-Nonce-Str":otStr, "X-Signature":mySign, "X-Timestamp":time_str}
	 			//console.log(header)	
				return 	fetch('https://open.revenuemonster.my/v3/stores', {
						headers:header,
						method:'GET'
					}).then(res => res.json())
					.catch(error => console.error('Error:', error))
					.then(response => {
						//console.log('Success:', response)
					})
				})
		})
	} else {
		return exports.generateSign(data, method, otStr, priv_key, myurl, signtype, time_str).then(function(){
			var header = {"Authorization":"Bearer " + myToken, "Content-Type":"application/json", "X-Nonce-Str":otStr, "X-Signature":mySign, "X-Timestamp":time_str}
	 		console.log(header)	
			return 	fetch('https://open.revenuemonster.my/v3/stores', {
					headers:header,
					method:'GET'
				}).then(res => res.json())
				.catch(error => console.error('Error:', error))
				.then(response => {
					//console.log('Success:', response)
				})
		})
	}
}

module.exports.refundPayment = function(transId, refundAmount, reason, type) {
	var method = "post"
	var signtype = "sha256"
	var myurl = "https://open.revenuemonster.my/v3/payment/refund"
	var time = Math.floor(Date.now()/1000)
	var time_str = time.toString()
	var otStr = exports.makeid()
	var priv_key = exports.getPrivateKeySomehow()
	var data1 = {}
	var data = {
		"transactionId": transId,
		"refund": {
			"type": type,
			"currencyType": "MYR",
			"amount": refundAmount
		},
		"reason": reason
	}
	var jsondata = JSON.stringify(data)
	if (myToken == undefined) {
		return exports.requestToken().then(function(){
			return exports.generateSign(data, method, otStr, priv_key, myurl, signtype, time_str).then(function(){
				var header = {"Authorization":"Bearer " + myToken, "Content-Type":"application/json", "X-Nonce-Str":otStr, "X-Signature":mySign, "X-Timestamp":time_str}
	 			//console.log(header)	
				return 	fetch('https://open.revenuemonster.my/v3/payment/refund', {
						headers:header,
						method:'POST',
						body:jsondata 
					}).then(res => res.json())
					.catch(error => console.error('Error:', error))
					.then(response => {
						console.log('Success:', response)
						return response
					})
				})
		})
	} else {
		return exports.generateSign(data, method, otStr, priv_key, myurl, signtype, time_str).then(function(){
			var header = {"Authorization":"Bearer " + myToken, "Content-Type":"application/json", "X-Nonce-Str":otStr, "X-Signature":mySign, "X-Timestamp":time_str}
	 		//console.log(header)	
			return 	fetch('https://open.revenuemonster.my/v3/payment/refund', {
					headers:header,
					method:'POST',
					body:jsondata 
				}).then(res => res.json())
				.catch(error => console.error('Error:', error))
				.then(response => {
					console.log('Success:', response)
					return response
				})
			})
	}
}
