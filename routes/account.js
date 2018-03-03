var express = require('express');
var host = require('../scripts/host');
var utils = require('../scripts/utils');
var sql = require('../scripts/sql-builder/sql-builder');
var hash = require("password-hash");
var app = express.Router();
var logging = utils.logging;

var insertGoogleAccount = async function(name, email, phone, password, finish) {
	var password = hash.generate("google_" + password, {'algorithm': 'sha1', 'saltLength': 8, 'iterations': 1});
	if (phone == null) {
		var phone = "";
	}
	var query = sql.make_sql(sql.INSERT, 'cus_user')
		.addFields('name, email, phone, password')
		.addValues([name, email, phone, password]);
	var insertResult = await new Promise(resolve => {
		host.con.query(query.build(), (err, result) => {
			if(err) {
				res.send({error: {msg: 'failed to store data'}, result: null});
				logging("SQL_ERR/account/create-google: " + err.code + " " + query.build());
				reject(false);
			} else {
				resolve(true);
			}
		});
	});
	var response = await new Promise(resolve => {
		var query = sql.make_sql(sql.SELECT, 'cus_user')
			.addFields('user_id')
			.setCondition('email', sql.EqualTo, email);
		host.con.query(query.build(), (err, result) => {
			if(err) {
				res.send({error: {msg: 'failed to store data'}, result: null});
				logging("SQL_ERR/create_account-store: " + err.code + " " + query.build());
				reject(false);
			}
			finish({
					error: null, 
					result: {
						user_id: result[0].id, 
						name: name, 
						email: email, 
						phone: phone,
						favourite: []
					}
				});
				resolve(true);
		});
	});
}

app.post("/", (req, res) => {
	if(req.body.limit != null) {
		var limit = req.body.limit;
	} else {
		var limit = 10;
	}
	var offset = req.body.offset;
	var search = req.body.search;

	var query = sql.make_sql(sql.SELECT, "cus_user").addFields("user_id, name, email, phone").setOrder('user_id', sql.DESC).setLimit(offset, limit);
	if (search != null && search.length != 0) {
		query.setCondition(
				sql.make_cond(
					sql.make_cond("name", sql.LIKE, '%' + req.body.search + '%'), 
					sql.OR, 
					sql.make_cond('email', sql.LIKE, '%' + req.body.search + '%')
				), 
				sql.OR, 
				sql.make_cond("phone", sql.LIKE, '%' + req.body.search + '%'));
	}
	host.con.query(query.build(), (err, result) => {
		if(!err) {
			res.send({error: null, result: result});
		} else {
			res.send({error: {msg: 'failed to acquire data'}, result: null});
			logging("SQL_ERR/account: " + err.code + " " + query.build());
		}
	});
});

app.get("/register", (req, res) => {
	req.session.authorized = true;
	res.render("register-user.ejs", {domain: host.DOMAIN});
});

app.post("/:user_id/edit", (req,res) => {
	if(utils.null_check([req.body.user_id])) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}
	var user_id = req.params.user_id;
	var query = sql.make_sql(sql.SELECT, 'cus_usere')
		.addFields('name, email, phone, password')
		.setCondition('user_id', sql.EqualTo, user_id);
	host.con.query(query.build(), (err, result) => {
		if(err) {
			res.send({error: {msg: 'failed to validate data'}, result: null});
			logging("SQL_ERR/account/"+user_id+"/edit: " + err.code + " " + query.build());
			return;
		}
		if(result.length == 0) {
			res.send({error: {msg: 'user does not exist'}, result: null});
			return;
		}

		var name = result[0].name;
		var email = result[0].email;
		var phone = result[0].phone;
		var password = result[0].password;

		if(req.body.current_password == null || req.body.password_1 == null || req.body.password_2 == null) {
			if(!(req.body.current_password == null && req.body.password_1 == null && req.body.password_2 == null)) {
				if(!req.body.current_password) {
					res.send({error: {msg: 'please fill the current password'}, result: null});
					return;
				}
				if(!req.body.password_1 && req.body.password_2) {
					res.send({error: {msg: 'please fill the new password'}, result: null});
					return;
				}
				if(req.body.password_1 && !req.body.password_2) {
					res.send({error: {msg: 'please retype new password'}, result: null});
					return;
				}
			}
		} else {
			if(!hash.verify(req.body.current_password, password)) {
				res.send({error: {msg: 'invalid current password'}, result: null});
				return;
			}
			if(req.body.password_1 != req.body.password_2) {
				res.send({error: {msg: 'new passwords do not match'}, result: null});
				return;
			}
			password = hash.generate(req.body.password_1, {'algorithm': 'sha1', 'saltLength': 8, 'iterations': 1});
		}

		if(req.body.name != null) name = req.body.name;
		if(req.body.email != null) email = req.body.email;
		if(req.body.phone != null) phone = req.body.phone;

		var query = sql.make_sql(sql.UPDATE, 'cus_user')
			.addFields('name, email, phone, password')
			.addValues([name, email, phone, password])
			.setCondition('user_id', sql.EqualTo.user_id);
		host.con.query(query.build(), (err, result) => {
			if(err) {
				res.send({error: {msg: 'failed to update data'}, result: null});
				logging("SQL_ERR/account/"+user_id+"/edit: " + err.code + " " + query.build());
			} else {
				res.send(
				{
					error: null, 
					result: 
					{
						id: user_id, 
						name: name, 
						email: email, 
						phone: phone,
						favourite: []
					}
				});
			}
		});
	});
});

app.post("/create", (req, res) => {
	if(utils.null_check([req.body.name, req.body.email, req.body.password_1, req.body.password_2])) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}

	if(req.body.phone != null) {
		var phone = req.body.phone;
	} else {
		var phone = "";
	}

	var name = req.body.name;
	var email = req.body.email;
	var password_1 = req.body.password_1;
	var password_2 = req.body.password_2;

	var query = sql.make_sql(sql.SELECT, 'cus_user').addFields('email').setCondition('email', sql.EqualTo, email);

	host.con.query(query.build(), (err, result) => {
		if(result.length != 0) {
			res.send({error: {msg: 'failed: email has been exist'}, result: null});
			return;
		}
		if(req.body.password_1 != req.body.password_2) {
			res.send({error: {msg: 'password mismatch'}, result: null});
			return;
		}
		var password = hash.generate(password_1, {'algorithm': 'sha1', 'saltLength': 8, 'iterations': 1});
		var query = sql.make_sql(sql.INSERT, 'cus_user')
			.addFields('name, email, phone, password')
			.addValues([name, email, phone, password]);
		host.con.query(query.build(), (err, result) => {
			if(err) {
				res.send({error: {msg: 'failed to store data'}, result: null});
				logging("SQL_ERR/account/create: " + err.code + " " + query.build());
				return;
			}

			var query = sql.make_sql(sql.SELECT, 'cus_user').addFields('user_id').setCondition('email', sql.EqualTo, email);
			host.con.query(query.build(), (err, result) => {
				if(err) {
					res.send({error: {msg: 'failed to store data'}, result: null});
					logging("SQL_ERR/accunt/create: " + err.code + " " + query.build());
					return; 
				}
				res.send(
					{
						error: null, 
						result: {
							id: result[0].id, 
							name: name, 
							email: email, 
							phone: phone,
							favourite: []
						}
					});
			});
		});
	});
});

app.post("/verify", (req, res) => {
	if(utils.null_check([req.body.email, req.body.password])) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}
	var name = req.body.name;
	var password = req.body.password;
	var email = req.body.email;
	var phone = req.body.phone;
	var loginType = req.body.login_type;

	var query = sql.make_sql(sql.SELECT, 'cus_user')
		.addFields('user_id, name, phone, password')
		.setCondition('email', sql.EqualTo, email);

	var task = async () => {
		var response_1 = await new Promise((resolve, reject) => {
			host.con.query(query.build(), (err, result) => {
				if(err) {
					res.send({error: {msg: 'failed to verify data'}, result: null});
					logging("SQL_ERR/account/verify: " + err.code + " " + query.build());
					reject(err);
				} 
				resolve(result);
			});
		});
		if(response_1.length == 0) {
			if(loginType == "google") {
				await insertGoogleAccount(name, email, phone, password, (result) => {
					res.send({error: null, result: result});
				});
			} else {
				res.send({error: {msg: 'user does not exist'}, result: null});
				return;
			}
		} else {
			if(loginType == "google") {
				password = "google_" + password;
			} 
			if(!hash.verify(password, response_1[0].password)) {
				res.send({error: {msg: 'wrong password'}, result: null});
				return;
			}
			var response_2 = await new Promise((resolve, reject) => {
				var query = "SELECT item_id FROM cus_favourite WHERE user_id =" + "'" + response_1[0].id + "'";
				host.con.query(query, (err, result) => {
					if(err) {
						res.send({error: {msg: 'failed to verify data'}, result: null});
						logging("SQL_ERR/verify-favourite: " + err.code);
						reject(false);
					} else {
						res.send(
							{
								error: null, 
								result: {
									id: response_1[0].id, 
									name: response_1[0].name, 
									email: req.body.email, 
									phone: response_1[0].phone,
									favourite: response_2
								}
							});
						resolve(true);
					}
				});
			});
		}
	}

	task().catch((err) => {
		console.log(err);
	});
});

module.exports = app;