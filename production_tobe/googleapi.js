const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');


const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.appdata'];
const TOKEN_PATH = './credentials/token.json';
const cross_outlet_folder = '1B3tukOVsH-svq1sst2j9PFkBxUVq4a9p'

///////////////////////////////////////////////////////////////////////////////////
//// upload or update the files in google drive ///////////////////////////////////
// call the listFiles function first to check whether the files is there or not ///
///////////////////////////////////////////////////////////////////////////////////
console.log("testing")
module.exports.updateOrupload = function(credentials, callback, fpath, fname, pname) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    console.log(JSON.parse(token))
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client, fpath, fname, pname);
  });
}

/////////////////////////////////////////////////////////
///// Download files from drive if found the files //////
/////////////////////////////////////////////////////////

module.exports.download = function(credentials, callback, fpath, fname, pname) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    console.log(JSON.parse(token))
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client, fpath, fname, pname);
  });
}
/////////////////////////////////////////////////////
///// Create the folder in Google drive /////////////
/////////////////////////////////////////////////////


module.exports.createFolder = function(credentials, folderName, cb) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, cb);
    console.log(JSON.parse(token))
    oAuth2Client.setCredentials(JSON.parse(token));
    cFolder(oAuth2Client, folderName)
  })
}

function cFolder (auth, fname) {
  const drive = google.drive({version: 'v3', auth});
  var fileMetadata = {
    'name': fname,
    'mimeType': 'application/vnd.google-apps.folder'
  };
  drive.files.create({
    resource: fileMetadata,
    fields: 'id'
  }, function (err, file) {
    if (err) {
      // Handle error
      console.error(err);
    } else {
      console.log('Folder Id: ', file.data.id);
    }
  });
}


/////////////////////////////////////////////////////////////////////////////
// Get and store new token after prompting for user authorization, and then
// execute the given callback with the authorized OAuth2 client.
// @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
// @param {getEventsCallback} callback The callback for the authorized client.
 /////////////////////////////////////////////////////////////////////////////
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

//////////////////////////////////////////////////////////////////
// Lists the names and IDs 
// @param {google.auth.OAuth2} auth An authorized OAuth2 client.
//////////////////////////////////////////////////////////////////

module.exports.listFiles = function(auth, fpath, fname, prts) {
  const drive = google.drive({version: 'v3', auth});
  var count = 0;
  drive.files.list({
    fields: 'nextPageToken, files(id, name), files/parents',
    spaces: 'drive'
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const files = res.data.files;
    if (files.length) {
      console.log('Files:');
      files.map((file) => {
      	//console.log(`${file.name} (${file.id}) (${file.parents[0]})`);
        if (file.name == fname && file.parents[0] == prts) {
          count++;
        	console.log(`${file.name} (${file.id})`);
        	updateFiles(auth, fpath, fname, file.id, prts)
        }
      });
      if (count == 0) {
        uploadFiles(auth, fpath, fname, prts);
      }
    } else {
      console.log('No files found.');
    }
  });
}

/// upload files sub function 


function uploadFiles (auth, filepath, filename, prt) {
  console.log("uploading files "+ filename)
	const drive = google.drive({version: 'v3', auth});
  if (filename.match(/json/g)) {
    var type1 = 'application/vnd.google-apps.script'
    var type2 = 'application/json'
  } else if (filename.match(/csv/g)) {
    var type1 = 'application/vnd.google-apps.spreadsheet'
    var type2 = 'text/csv'
  }
	var fileMetadata = {
  		'name': filename,
      parents: [prt]
	};
	var filepath = filepath
	var media = {
 		mimeType: type2,
  		body: fs.createReadStream(filepath)
	};
	drive.files.create({
  		resource: fileMetadata,
  		media: media,
  		fields: 'id'
	}, function (err, file) {
  		if (err) {
    	// Handle error
    		console.error(err);
  		} else {
  			//console.log(file)
    		console.log('File Id:', file.data.id);
  		}
	});
}

/// update files sub function 

function updateFiles (auth, filepath, filename, fileID, prtID) {
  console.log("updating files "+filename)
	const drive = google.drive({version: 'v3', auth});
  if (filename.match(/json/g)) {
    var type1 = 'application/vnd.google-apps.script'
    var type2 = 'application/json'
  } else if (filename.match(/csv/g)) {
    var type1 = 'application/vnd.google-apps.spreadsheet'
    var type2 = 'text/csv'
  }
	var filepath = filepath
	var fileMetadata = {
  	'name': filename,
    addParents: [prtID]
	};
	var media = {
 		mimeType: type2,
  	body: fs.createReadStream(filepath)
	};
	drive.files.update({
  		resource: fileMetadata,
  		media: media,
  		fields: 'id',
  		fileId: fileID
	}, function (err, file) {
  		if (err) {
    	// Handle error
    		console.error(err);
  		} else {
    		console.log('File Id:', file.data.id);
  		}
	});
}

/// Download files sub function 

module.exports.downloadFiles = function(auth, filepath, filename, prts) {
	const drive = google.drive({version: 'v3', auth});
  if (filename.match(/json/g)) {
    var type1 = 'application/vnd.google-apps.file'
    var type2 = 'text/plain'
  } else if (filename.match(/csv/g)) {
    var type1 = 'application/vnd.google-apps.spreadsheet'
    var type2 = 'text/csv'
  }
  var count = 0;
  drive.files.list({
    fields: 'nextPageToken, files(id, name), files/parents',
    spaces: 'drive'
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const files = res.data.files;
    if (files.length) {
      //console.log('Files:');
      files.map((file) => {
        //console.log(`${file.name} (${file.id})`);
        if (file.name == filename && file.parents[0] == prts) {
          count++;
          console.log(`${file.name} (${file.id})`);
          var dest = fs.createWriteStream(filepath);
          drive.files.get({
              fileId: file.id,
              mimeType: 'application/json',
              alt: 'media'
          }, {
                responseType: 'stream'
            },function(err, response){
                if(err){
                  console.error(err);
                }
                response.data.on('error', err => {
                    //done(err);
                }).on('end', ()=>{
                    //done();
                })
                .pipe(dest);
            })
        }
      })
      if (count == 0) {
        console.log("The file "+filename+" is not exist in the google drive")
      }
    }
  })
}
