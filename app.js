var express = require("express");
var fs = require("fs");
var app = express();
var bodyParser = require("body-parser");
var session = require('express-session');
var MySQLStore = require('express-mysql-session');
var path = require('path');
var fse = require('fs-extra');
var idGen = require('./scripts/id-gen');
var host = require('./scripts/host');
var util = require('./scripts/utils');
var multer  = require('multer')
var upload = multer({dest: "img/temp/"});

var sessionStore;
var logging = util.logging;

app.set("view engine", "ejs");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(session({
	key: 'session_authorized',
	secret: 'authorized',
	store: sessionStore,
	resave: false,
	saveUninitialized: false
}));

app.use("/", function(req, res, next) {
	logging("REQUEST" + req.originalUrl + ": body{" + JSON.stringify(req.body) + "}, " + "header{" + JSON.stringify(req.headers) + "}");
	if (req.method == "POST") {
		if(req.headers.authorization != host.KEY && req.session.authorized == undefined) {
			res.send({error: {msg: 'unauthorized'}, result: null});
			return;
		}
	}
	next();
});

app.get("/", (req, res) => {
	req.session.authorized = true;
	res.render("main.ejs", {domain: host.DOMAIN, dir: host.DIR});
});

app.use('/account', require('./routes/account'));
app.use('/faq', require('./routes/faq'));
app.use('/payment', require('./routes/payment'));
app.use('/toko', require('./routes/toko'));

function init() {
	fs.writeFile("log.dat", "", (err) => {
		if(err) {
			console.log("Error cleaning log!");
		} else {
			host.makeConnection((err, message) => {
				if (err) {
					console.log("Error init host! "  + message);
				} else {
					idChecking();
				}
			});
		}
	});
}

async function idChecking() {
	var getTransactionId = "SELECT MAX(transaction_id) as transaction_id FROM `cus_transaction`";
	var transactionId = await new Promise(resolve => {
		host.con.query(getTransactionId, (err, result) => {
			if (err) {
				resolve(-1);
			} else {
				idGen.setTransactionId(result[0].transaction_id);
				resolve(result[0].transaction_id);
			}
		});
	});
	serverUp();
}

function serverUp() {
	app.listen(3000, () => {
		sessionStore = new MySQLStore({}, host.con);
		console.log("Server On!");
	});
}

init();