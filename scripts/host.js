var mysql = require("mysql");
var fs = require("fs");

var host = fs.readFileSync('host.dat', 'utf8').split(",");
HOST_HOST = host[0];
HOST_USER = host[1];
HOST_PASS = host[2];
HOST_PORT = host[3];
HOST_DB = host[4];
HOST_DOMAIN = host[5];
HOST_KEY = host[6];
HOST_DIR = host[7];

if(HOST_PASS == 0) {
	HOST_PASS = "";
}
if(HOST_PORT == 0) {
	HOST_PORT = null;
}
var con = mysql.createConnection({
	host: HOST_HOST,
	user: HOST_USER,
	password: HOST_PASS,
	port: HOST_PORT,
	database: HOST_DB
});
var makeConnection = function(callback) {
	con.connect(function(err) {
		if(!err) {
			callback(false, null);
		} else {
			callback(true, err.code);
		}
	});
}

var getHost = function() {return HOST_HOST;}
var getUser = function() {return HOST_USER;}
var getPass = function() {return HOST_PASS;}
var getPort = function() {return HOST_PORT;}
var getDatabase = function() {return HOST_DB;}
var getDomain = function() {return HOST_DOMAIN;}
var getKey = function() {return HOST_KEY;}
var getDir = function() {return HOST_DIR;}

module.exports = {
	HOST: getHost(),
	USER: getUser(),
	PASS: getPass(),
	PORT: getPort(),
	DB: getDatabase(),
	DOMAIN: getDomain(),
	KEY: getKey(),
	DIR: getDir(),
	makeConnection: makeConnection,
	con: con
}