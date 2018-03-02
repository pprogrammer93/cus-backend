var express = require('express');
var host = require('../scripts/host');
var utils = require('../scripts/utils');
var idGen = require('../scripts/id-gen');
var app = express.Router();
var logging = utils.logging;

app.get("/payment/:transaction_id", (req, res) => {
	req.session.authorized = true;
	res.render("review.ejs", {id: req.params.transaction_id, domain: host.DOMAIN, dir: host.DIR});
});

app.post("/payment/:transaction_id/confirm", (req, res) => {
	if(!(req.body.payment_id)) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}
	var replace = "UPDATE `cus_transaction` SET status=1 WHERE id=" + req.body.payment_id;
	host.con.query(replace, (err, result) => {
		if(err) {
			res.send({error: {msg: 'failed to change data'}, result: null});
			logging("SQL_ERR/payment-confirmation: " + err.code + " " + replace);
		} else {
			res.send({error: null, result: null});
		}
	});
}); 

app.post("/payment/:transaction_id/delete", (req = null, res = null) => {
	var del = "DELETE FROM `cus_transaction` WHERE transaction_id=" + transaction_id;
	host.con.query(del,(err, result) => {
		if(err) {
			res.send({error: {msg: 'failed to delete transaction'}, result: null});
			logging("SQL_ERR/payment-delete: " + err.code + " " + sql);
		} else {
			var page = "http://" + host.DOMAIN;
			res.redirect(page);
		}
	});
});

app.post("/payment/:transaction_id/rate", (req, res) => {
	if(!(req.body.rating)) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}
	var replace = "UPDATE `cus_transaction` SET status=2, rating=" + req.body.rating + " WHERE transaction_id=" + req.params.transaction_id;
	host.con.query(replace, (err, result) => {
		if(!err) {
			res.send({error: null, result: null});
		} else {
			res.send({error: {msg: 'failed to give rating'}, result: null});
			logging("SQL_ERR/payment-rate: " + err.code + " " + replace);
		}
	});
});

module.exports = app;

