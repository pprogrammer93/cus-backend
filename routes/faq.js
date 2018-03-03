var express = require("express");
var host = require('../scripts/host');
var utils = require('../scripts/utils');
var sql = require('../scripts/sql-builder/sql-builder');
var app = express.Router();
var logging = utils.logging;

app.get("/", (req, res) => {
	req.session.authorized = true;
	res.render("faq.ejs", {domain: host.DOMAIN, dir: host.DIR});
});

app.get("/get", (req, res) => {
	query = sql.make_sql(sql.SELECT, 'cus_faq').addFields('faq_id, question, answer');
	host.con.query(query.build(), (err, result) => {
		if(err) {
			res.send({error: {msg: 'failed to retrieve data'}, result: null});
			logging("SQL_ERR/faq/get: " + err.code);
		} else {
			res.send({error: null, result: result});
		}
	});
});

app.post("/:faq_id/edit", (req, res) => {
	if (utils.null_check([req.body.answer])) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}

	var faq_id = req.params.faq_id;
	var answer = req.body.answer.replace(/'/g, "&#39");

	var query = sql.make_sql(sql.UPDATE, 'cus_faq').addFields('answer').addValues([answer]).setCondition('faq_id', sql.EqualTo, faq_id);
	host.con.query(query.build(), (err, result) => {
		if(err) {
			res.send({error: {msg: 'failed to update or insert data'}, result: null});
			logging("SQL_ERR/faq/"+faq_id+"/edit: " + err.code + " " + query.build());
		} else {
			res.redirect("http://" + host.DOMAIN + "/faq");
		}
	});
});

app.post("/create", (req, res) => {
	if (utils.null_check([req.body.question, req.body.answer])) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}

	var question = req.body.question.replace(/'/g, "&#39");
	var answer = req.body.answer.replace(/'/g, "&#39");

	var query = sql.make_sql(sql.INSERT, 'cus_faq').addFields('question, answer').addValues([question, answer]);
	host.con.query(query.build(), (err, result) => {
		if(err) {
			res.send({error: {msg: 'failed to update or insert data'}, result: null});
			logging("SQL_ERR/faq/create: " + err.code + " " + query.build());
		} else {
			res.redirect("http://" + host.DOMAIN + "/faq");
		}
	});
});

app.post("/:faq_id/delete", (req, res) => {
	var faq_id = req.params.faq_id;
	var query = sql.make_sql(sql.DELETE, 'cus_faq').setCondition('faq_id', sql.EqualTo, faq_id);
	host.con.query(query.build(), (err, result) => {
		if(err) {
			res.send({error: {msg: 'failed to delete data'}, result: null});
			logging("SQL_ERR/faq/"+faq_id+"delete: " + err.code + " " + query.build());
		} else {
			res.redirect("http://" + host.DOMAIN + "/faq");
		}
	});
});

module.exports = app;