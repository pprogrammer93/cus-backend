var express = require("express");
var fs = require("fs");
var hash = require("password-hash");
var app = express();
var bodyParser = require("body-parser");
var session = require('express-session');
var MySQLStore = require('express-mysql-session');
var path = require('path');
var fse = require('fs-extra');
var idGen = require('./scripts/id-gen');

const HOST_HOST = 0;
const HOST_USER = 1;
const HOST_PASS = 2;
const HOST_PORT = 3;
const HOST_DB = 4;
const HOST_DOMAIN = 5;
const HOST_KEY = 6;
const HOST_DIR = 7;

var TRANSACTION_ID;
var MYSQL_SYNC;
function getTransactionId() {
	var transaction_id = TRANSACTION_ID;
	TRANSACTION_ID = TRANSACTION_ID + 1;
	return transaction_id;
}

var host = fs.readFileSync('host.dat', 'utf8').split(",");
if(host[HOST_PASS] == 0) {
	host[HOST_PASS] = "";
}
if(host[HOST_PORT] == 0) {
	host[HOST_PORT] = null;
}
var mysql = require("mysql");
var con = mysql.createConnection({
	host: host[HOST_HOST],
	user: host[HOST_USER],
	password: host[HOST_PASS],
	port: host[HOST_PORT],
	database: host[HOST_DB]
});
var connect_msg = "";
con.connect(function(err) {
	if(!err) {
		connect_msg = "Hi there!";
	} else {
		connect_msg = "Opps! " + err.code;
	}
});

var sessionStore = new MySQLStore({}, con);
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
		if(req.headers.authorization != host[HOST_KEY] && req.session.authorized == undefined) {
			res.send({error: {msg: 'unauthorized'}, result: null});
			return;
		}
	}
	next();
});


app.get("/", (req, res) => {
	req.session.authorized = true;
	res.render("main.ejs", {domain: host[HOST_DOMAIN], dir: host[HOST_DIR]});
});

app.get("/register-toko", (req, res) => {
	req.session.authorized = true;
	res.render("register-toko.ejs", {domain: host[HOST_DOMAIN], dir: host[HOST_DIR]});
});

app.get("/register-user", (req, res) => {
	req.session.authorized = true;
	res.render("register-user.ejs", {domain: host[HOST_DOMAIN]});
});

app.get("/toko/:toko_id/register-item", (req, res) => {
	req.session.authorized = true;
	res.render("register-item.ejs", {domain: host[HOST_DOMAIN], toko_id: req.params.toko_id, dir: host[HOST_DIR]});
});

app.get("/toko/:id", (req, res) => {
	req.session.authorized = true;
	res.render("toko.ejs", {id: req.params.id, domain: host[HOST_DOMAIN], dir: host[HOST_DIR]});
});

app.get("/toko/:toko_id/item/:id", (req, res) => {
	req.session.authorized = true;
	res.render("item.ejs", {toko_id: req.params.toko_id, id: req.params.id, domain: host[HOST_DOMAIN], dir: host[HOST_DIR]});
});

app.get("/payment/:transaction_id", (req, res) => {
	req.session.authorized = true;
	res.render("review.ejs", {id: req.params.transaction_id, domain: host[HOST_DOMAIN], dir: host[HOST_DIR]});
});

app.get("/faq", (req, res) => {
	req.session.authorized = true;
	res.render("faq.ejs", {domain: host[HOST_DOMAIN], dir: host[HOST_DIR]});
});

var delete_transaction = function(req = null, res = null) {
	var del = "DELETE FROM `cus_transaction` WHERE transaction_id=" + transaction_id;
	con.query(del,(err, result) => {
		if(err) {
			res.send({error: {msg: 'failed to delete transaction'}, result: null});
			logging("SQL_ERR/payment-delete: " + err.code + " " + sql);
		} else {
			var page = "http://" + host[HOST_DOMAIN];
			res.redirect(page);
		}
	});
}

var expire_transaction = function(transaction_id) {
	var sql = "UPDATE `cus_transaction` SET status=3 WHERE transaction_id='" + transaction_id + "'";
	con.query(sql, (err, result) => {
		if (err) {
			logging("SQL_ERR/expire_transaction: " + err.code + " " + sql);
		} else {
			logging("SQL_ERR/expire_transaction: transaction " + transaction_id + " has been changed to expired.");
		}
	});
}

app.post("/getToko", (req, res) => {
	logging("REQUEST/getToko: body{" + JSON.stringify(req.body) + "}, " + "header{" + JSON.stringify(req.headers) + "}");

	var sql;

	if(!req.body.toko_id) {
		var limit = 10;
		if(req.body.limit) {
			limit = req.body.limit;
		}
		if(req.body.search) {
			sql = "SELECT id, name, img_url, address, description, category FROM `cus_toko`" +
				" WHERE name LIKE '%" + req.body.search + "%' OR address LIKE '%" +
				req.body.search + "%' ORDER BY id DESC LIMIT " + req.body.offset + ", " + limit;
		} else {
			sql = "SELECT id, name, img_url, address, description, category FROM `cus_toko`" +
					" ORDER BY id DESC LIMIT " + req.body.offset + ", " + limit;
		}
	} else {
		sql = "SELECT name, img_url, address, description, category, open_at, close_at, latitude, longitude, phone " +
			"FROM `cus_toko` WHERE id=" + req.body.toko_id;
	}

	con.query(sql, (err, result_1) => {
		if(!err) {
			if(req.body.count && !req.body.toko_id) {
				if(req.body.search) {
					sql = "SELECT id FROM `cus_toko` + WHERE name LIKE '%" + req.body.search + "%' OR address LIKE '%" +
						req.body.search + "%'";
				} else {
					sql = "SELECT id FROM `cus_toko`";
				}
				con.query(sql, (err, result_2) => {
					if(!err) {
						res.send({error: null, result: {
							toko: result_1,
							count: result_2
						}});
					} else {
						res.send({error: {msg: 'failed to acquire data'}, result: null});
						logging("SQL_ERR/place: " + err.code);
					}
				});
			} else {
				res.send({error: null, result: result_1});
			}
		} else {
			res.send({error: {msg: 'failed to acquire data'}, result: null});
			logging("SQL_ERR/place: " + err.code);
		}
	});
});

app.post("/get-user", (req, res) => {
	var limit = 10;
	if(req.body.limit) {
		limit = req.body.limit;
	}
	if(req.body.search) {
		sql = "SELECT id, name, email, phone FROM `cus_user`" +
			" WHERE name LIKE '%" + req.body.search + "%' OR email LIKE '%" +
			req.body.search + "%' OR phone LIKE '%" + req.body.search + "%' ORDER BY id DESC LIMIT " + req.body.offset + ", " + limit;
	} else {
		sql = "SELECT id, name, email, phone FROM `cus_user`" +
				" ORDER BY id DESC LIMIT " + req.body.offset + ", " + limit;
	}

	con.query(sql, (err, result) => {
		if(!err) {
			res.send({error: null, result: result});
		} else {
			res.send({error: {msg: 'failed to acquire data'}, result: null});
			logging("SQL_ERR/place: " + err.code + " " + sql);
		}
	});
});

app.post("/toko/:toko_id/create-item", (req, res) => {	
	if(!(req.body.name && req.body.price)) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}
	if(req.file && req.file.size > (4 * 1024 * 1024)) {
		res.send({error: {msg: 'image too large'}, result: null});
		return;
	}

	var description = "-";
	if(req.body.description) {
		description = req.body.description;
	}
	var img_url = "";
	if(req.body.img_url) {
		img_url = req.body.img_url;
	}

	if(req.file != undefined) {
		var extension = req.file.originalname.split(".");
		var filepath = "img/temp/" + req.file.filename;
		var img_id = idGen.getItemImageId();
		var img_name = req.body.name.replace(/ /g, '_');
		var img_storage = "img/item/" + req.params.toko_id + "/" + img_id + "_" + img_name + "." + extension[1];
		img_url = "http://" + host[HOST_DIR] + "/" + img_storage;

		if(req.body.edit && req.body.img_url != "") {
			var old_img = req.body.img_url.substring(req.body.img_url.indexOf("img"), req.body.img_url.length);
			fs.unlink(old_img, function (err) {
				if(err) {
					logging("IMAGE/create_toko-insert: " + err.code + " Need to erase image manually.");
				} else {
					fs.rename(filepath, img_storage, function (err) {
					  if (err) {
						logging("IMAGE/create_toko-insert: " + err.code);
						return;
					  }
					});
				}
			});
		} else {
			fs.rename(filepath, img_storage, function (err) {
			  if (err) {
				logging("IMAGE/create_item-insert: " + err.code);
			  } 
			});
		}
	} else {
		if(req.body.edit) {
			if(img_url != "") {
				var toko_id = req.params.toko_id;
				var start = img_url.substring(0, img_url.indexOf("item") + 5);
				var domain = start.substring(0, start.indexOf("img"));
				var dir = start.substring(start.indexOf("img"), start.length);

				var end = img_url.substring(img_url.indexOf("item") + 6, img_url.length);
				var extension = end.substring(end.indexOf(".") + 1, end.length);
				var img_id = end.substring(end.indexOf("/")+1, end.indexOf("_"));

				var old_name = end.substring(end.indexOf("_")+1, end.indexOf("."));
				var img_name = req.body.name.replace(/ /g, '_');
				var old_img = dir + toko_id + "/" + img_id + "_" + old_name + "." + extension;
				var img_storage = dir + "/" + toko_id + "/" + img_id + "_" + img_name + "." + extension;
				img_url = domain + img_storage;

				fs.rename(old_img, img_storage, function (err) {
				  if (err) {
					logging("IMAGE/create_toko-insert: " + err.code + " " + old_img + " " + img_storage);
					return;
				  }
				});
			}
		}
	}

	var insert;
	if(req.body.edit) {
		insert = "REPLACE INTO cus_item (id, toko_id, name, price, description, img_url) " + 
			"VALUES ('" + req.body.item_id + "','" + req.params.toko_id + "','" + req.body.name + "','" + req.body.price + "','" + description +
			"','" + img_url + "')";
	} else {
		insert = "INSERT INTO cus_item (toko_id, name, price, description, img_url) " + 
			"VALUES ('" + req.params.toko_id + "','" + req.body.name + "','" + req.body.price + "','" + description +
			"','" + img_url + "')";
	}
	
	con.query(insert, (err, result) => {
		if(err) {
			res.send({error: {msg: 'failed to store data'}, result: null});
			logging("SQL_ERR/create_item-insert: " + err.code);
			fs.unlink(img_storage, function (err) {
			 	logging("IMAGE/create_item-insert: " + err.code + " " + img_storage + " Need to erase image manually.");
			});
			return;
		}
		if(req.body.edit) {
			var page = "http://" + host[HOST_DOMAIN] + "/" + "toko/" + req.params.toko_id + "/item/" + req.body.item_id;
			res.redirect(page);
		} else if (req.session.authorized != undefined) {
			var page = "http://" + host[HOST_DOMAIN] + "/" + "toko/" + req.params.toko_id;
			res.redirect(page);
		} else {
			res.send({error: null, result: null});
		}
	});
});

app.post("/create-toko", (req, res) => {
	if(!(req.body.name && req.body.address && req.body.open_at &&
			req.body.close_at && req.body.latitude && req.body.longitude && 
			req.body.phone && req.body.category)) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}
	if(req.file && req.file.size > (4 * 1024 * 1024)) {
		res.send({error: {msg: 'image too large'}, result: null});
		return;
	}

	var description = "-";
	var img_url = "";
	if(req.body.description) {
		description = req.body.description;
	}
	if(req.body.img_url) {
		img_url = req.body.img_url;
	}

	if(req.file != undefined) {
		var extension = req.file.originalname.split(".");
		var filepath = "img/temp/" + req.file.filename;
		var img_id = idGen.getTokoImageId();
		var img_name = req.body.name.replace(/ /g, '_');
		var img_storage = "img/toko/" + img_id + "_" + img_name + "." + extension[1];
		img_url = "http://" + host[HOST_DIR] + "/" + img_storage;

		if(req.body.edit) {
			var old_img = req.body.img_url.substring(req.body.img_url.indexOf("img"), req.body.img_url.length);
			fs.unlink(old_img, function (err) {
				if(err) {
					logging("IMAGE/create_toko-insert: " + err.code + " Need to erase image manually.");
				}
				fs.rename(filepath, img_storage, function (err) {
				  if (err) {
					logging("IMAGE/create_toko-insert: " + err.code);
					return;
				  }
				});
			});
		} else {
			fs.rename(filepath, img_storage, function (err) {
			  if (err) {
				logging("IMAGE/create_toko-insert: " + err.code);
				return;
			  }
			});
		}
	} else {
		if(req.body.edit) {
			if(img_url != "") {
				var start = img_url.substring(0, img_url.indexOf("toko") + 5);
				var domain = start.substring(0, start.indexOf("img"));
				var dir = start.substring(start.indexOf("img"), start.length);

				var end = img_url.substring(img_url.indexOf("toko") + 5, img_url.length);
				var extension = end.substring(end.indexOf(".") + 1, end.length);
				var img_id = end.substring(0, end.indexOf("_"));

				var old_name = end.substring(end.indexOf("_")+1, end.indexOf("."));
				var img_name = req.body.name.replace(/ /g, '_');
				var old_img = dir + img_id + "_" + old_name + "." + extension;
				var img_storage = dir + img_id + "_" + img_name + "." + extension;
				img_url = domain + img_storage;

				fs.rename(old_img, img_storage, function (err) {
				  if (err) {
					logging("IMAGE/create_toko-insert: " + err.code + " " + old_img + " " + img_storage);
					return;
				  }
				});
			}
		}
	}

	var insert;
	if(req.body.edit) {
		insert = "REPLACE INTO cus_toko (id, name, address, category, description, img_url, open_at, close_at, latitude, longitude, phone) " + 
			"VALUES ('" + req.body.toko_id + "','" + req.body.name + "','" + req.body.address + "','" + req.body.category + "','" + description + "','" + img_url +
			"','" + req.body.open_at + "','" + req.body.close_at + "','" + req.body.latitude + "','" + req.body.longitude + 
			"','" + req.body.phone + "')";
	} else {
		insert = "INSERT INTO cus_toko (name, address, category, description, img_url, open_at, close_at, latitude, longitude, phone) " + 
			"VALUES ('" + req.body.name + "','" + req.body.address + "','" + req.body.category + "','" + description + "','" + img_url +
			"','" + req.body.open_at + "','" + req.body.close_at + "','" + req.body.latitude + "','" + req.body.longitude + 
			"','" + req.body.phone + "')";
	}

	con.query(insert, (err, result) => {
		if(err) {
			res.send({error: {msg: 'failed to store data'}, result: null});
			logging("SQL_ERR/create_toko-insert: " + err.code);
			fs.unlink(img_storage, function (err) {
			 	logging("IMAGE/create_toko-insert: " + err.code + " " + img_storage + " Need to erase image manually.");
			});
			return;
		} else {
			if(req.body.edit) {
				var page = "http://" + host[HOST_DOMAIN] + "/" + "toko/" + req.body.toko_id;
				res.redirect(page);
			} else {
				fs.mkdir("img/item/" + result.insertId, (err) => {
					if(err) {
						res.send({error: {msg: 'failed to access filesystem'}, result: null});
						logging("FILE/create_toko-insert: " + err.code);
						var del = "DELETE FROM cus_toko WHERE id=" + result.insertId;
						con.query(del, (err, result) => {
						 	logging("SQL_ERR/create_toko-delete: " + err.code + " " + img_storage + " Need to delete row manually.");
						})
						fs.unlink(img_storage, function (err) {
						 	logging("IMAGE/create_toko-insert: " + err.code + " " + result.insertId + " Need to erase image manually.");
						});
						return;
					}
				})
				if(req.body.web) {
					var page = "http://" + host[HOST_DOMAIN];
					res.redirect(page);
				} else {
					res.send({error: null, result: null});
				}
			}
		}
	});
});

app.post("/toko/:id/delete", (req, res) => {
	var select = "SELECT img_url FROM `cus_toko` WHERE id='" + req.params.id + "'";
	con.query(select, (err, result) => {
		if(!err) {
			if (result[0].img_url != "") {
				img_url = result[0].img_url;
				img_storage = img_url.substring(img_url.indexOf("img"), img_url.length);
				fs.unlink(img_storage, (err) => {
					if(err) {
						logging("IMAGE/delete-toko: " + err.code + " Need to erase image manually.");
					}
				});
			}
			var img_items = "img/item/" + req.params.id;
			fse.remove(img_items, (err) => {
				if (err) {
					logging("IMAGE/delete-toko: " + err.code + " Need to erase folder " + img_items + " manually.");
				}
			});
			var del = "DELETE FROM `cus_toko` WHERE id='" + req.params.id + "'";
			con.query(del, (err, result) => {
					if(err) {
						res.send({error: {msg: 'failed to delete data toko'}, result: null});
						logging("SQL_ERR/delete-toko: " + err.code);
					} else {
						select = "SELECT id FROM `cus_item` WHERE toko_id='" + req.params.id + "'";
						con.query(select, (err, ids) => {
							if(err) {
								logging("SQL_ERR/delete-toko: " + err.code);
							} else {
								ids.forEach((id, index) => {
									del = "DELETE FROM `cus_favourite` WHERE item_id='" + id + "'";
									con.query(del, (err, result) => {
										if(err) {
											logging("SQL_ERR/delete-toko: " + err.code);
										}
									})
								});
							}
						});
						del = "DELETE FROM `cus_item` WHERE toko_id='" + req.params.id + "'";
						con.query(del, (err, result) => {
							if(err) {
								logging("SQL_ERR/delete-toko: " + err.code);
							}
						}); 
						var page = "http://" + host[HOST_DOMAIN];
						res.redirect(page);
					}
				});
		} else {
			res.send({error: {msg: 'failed to retrieve img_url'}, result: null});
			logging("SQL_ERR/delete-toko: " + err.code);
		}
	});
});

app.post("/toko/:toko_id/item/:id/delete", (req, res) => {
	var select = "SELECT img_url FROM `cus_item` WHERE id='" + req.params.id + "'";
	con.query(select, (err, result) => {
		if(err) {
			res.send({error: {msg: 'failed to retrieve img_url'}, result: null});
			logging("SQL_ERR/delete-item: " + err.code);
		} else {
			if (result[0].img_url != "") {
				var img_url = result[0].img_url;
				var img_storage = img_url.substring(img_url.indexOf("img"), img_url.length);
				fs.unlink(img_storage, (err) => {
					if(err) {
						logging("IMAGE/delete-item: " + err.code + " Need to erase image manually.");
					}
				});
			}
			var del = "DELETE FROM `cus_item` WHERE id='" + req.params.id + "'";
			con.query(del, (err, result) => {
				if(err) {
					res.send({error: {msg: 'failed to delete data item'}, result: null});
					logging("SQL_ERR/delete-item: " + err.code);
				} else {
					del = "DELETE FROM `cus_favourite` WHERE item_id='" + req.params.id + "'";
					con.query(del, (err, result) => {
						if(err) {
							res.send({error: {msg: 'failed to delete data favourite'}, result: null});
							logging("SQL_ERR/delete-item: " + err.code + " " + del);
						} else {
							var page = "http://" + host[HOST_DOMAIN] + /toko/ + req.params.toko_id;
							res.redirect(page);
						}
					});
				}
			});
		}
	});
});

app.post("/edit-account", (req,res) => {
	if(!req.body.user_id) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}

	var select = "SELECT name, email, phone, password FROM cus_user WHERE id='" + req.body.user_id + "'";
	con.query(select, (err, result) => {
		if(err) {
			res.send({error: {msg: 'failed to validate data'}, result: null});
			logging("SQL_ERR/edit_account-validate: " + err.code);
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

		if(req.body.name) {
			name = req.body.name;
		}
		if(req.body.email) {
			email = req.body.email;
		}
		if(req.body.phone) {
			phone = req.body.phone;
		}

		var update = "UPDATE cus_user SET name='" + name + "', email='" + email + 
			"', phone='" + phone + "', password='" + password + "' WHERE id='" + 
			req.body.user_id + "'";
		con.query(update, (err, result) => {
			if(err) {
				res.send({error: {msg: 'failed to update data'}, result: null});
				logging("SQL_ERR/edit_account-update: " + err.code);
				return;
			}
			res.send(
			{
				error: null, 
				result: {
					id: req.body.user_id, 
					name: name, 
					email: email, 
					phone: phone,
					favourite: []
				}
			});
		});
	});
});

app.post("/purchase", (req, res) => {
	if(!(req.body.user_id && req.body.estimation_hour && req.body.estimation_minute)) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}
	if(!req.body.item_list) {
		return;
	}

	var pending_purchase = [];
	var transaction_id = idGen.getTransactionId();
	var time = new Date();
	var created_at = time.getDate() + "-" + (time.getMonth() + 1) + "-" + time.getFullYear() + "-" + time.getHours() + ":" + time.getMinutes(); 
	var estimation = formatTime(req.body.estimation_hour, req.body.estimation_minute);

	item_list = req.body.item_list;
	item_list.forEach((item, index) => {
		if(!(item.toko_id && item.item_id && item.item_quantity && item.total_price && item.name)) {
			item.msg = "lack of data";
			pending_purchase.push(item);
		} else {
			var insert = "INSERT INTO cus_transaction (transaction_id, user_id, toko_id, item_id, name, item_quantity, total_price, created_at, estimation) " +
				"VALUES ('"+transaction_id+"','"+req.body.user_id+"','"+item.toko_id+"','"+item.item_id+"','"+ 
				item.name+"','"+item.item_quantity+"','"+item.total_price+"','"+created_at+"','"+estimation+"')";
			con.query(insert, (err, result) => {
				if(err) {
					logging("SQL_ERR/purchase: " + err.code + " for " + item);
					item.msg = "failed to store data";
					pending_purchase.push(item);
				}
				if((index+1) == item_list.length) {
					if(pending_purchase.length != 0) {
						res.send({error: {msg: "some purchase cannot be proceeded"}, pending_purchase});
					} else {
						res.send({error: null, result: {transaction_id: transaction_id}});
					}
				}
			});
		}
	});
});

app.post("/create-account", (req, res) => {
	if(!(req.body.name && req.body.email && req.body.password_1 && req.body.password_2)) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}

	var phone = "";
	if(req.body.phone) {
		phone = req.body.phone;
	}

	var select = "SELECT email FROM cus_user WHERE email=" + "'" + req.body.email + "'";

	user_id = 0;
	con.query(select, (err, result) => {
		if(result.length != 0) {
			res.send({error: {msg: 'failed: email has been exist'}, result: null});
			logging("SQL_ERR: try to register existed email");
			return;
		}
		if(req.body.password_1 != req.body.password_2) {
			res.send({error: {msg: 'password mismatch'}, result: null});
			return;
		}

		var passHash = hash.generate(req.body.password_1, {'algorithm': 'sha1', 'saltLength': 8, 'iterations': 1});

		var name = "'" + req.body.name + "'";
		var email = "'" + req.body.email + "'";
		var phone = "'" + req.body.phone + "'";
		var password = "'" + passHash + "'";
		var sql = "INSERT INTO cus_user (name, email, phone, password) VALUES (" + name + "," + email + "," + phone + "," + password + ")";
		
		con.query(sql, (err, result) => {
			if(err) {
				res.send({error: {msg: 'failed to store data'}, result: null});
				logging("SQL_ERR/create_account-validate: " + err.code);
				return;
			}
			sql = "SELECT id FROM cus_user WHERE email=" + "'" + req.body.email + "'";

			con.query(sql, (err, result) => {
				if(err) {
					res.send({error: {msg: 'failed to store data'}, result: null});
					logging("SQL_ERR/create_account-store: " + err.code);
					return;
				}
				user_id = result[0].id;
				res.send(
					{
						error: null, 
						result: {
							id: result[0].id, 
							name: req.body.name, 
							email: req.body.email, 
							phone: req.body.phone,
							favourite: []
						}
					});
			});
		});
	});
});

app.post("/verify", (req, res) => {
	var password = req.body.password;

	if(!(req.body.email && password != null)) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}

	var sql = "SELECT id, name, phone, password FROM cus_user WHERE email=" + "'" + req.body.email + "'";
	con.query(sql, (err, result_1) => {
		if(err) {
			res.send({error: {msg: 'failed to verify data'}, result: null});
			logging("SQL_ERR/verify-user: " + err.code);
			return;
		}
		if(result_1.length == 0) {
			if(req.body.login_type && req.body.login_type == "google") {
				var p = "google_" + req.body.password;
				passHash = hash.generate(p, {'algorithm': 'sha1', 'saltLength': 8, 'iterations': 1});
				var name = "'" + req.body.name + "'";
				var email = "'" + req.body.email + "'";
				var phone = "'" + req.body.phone + "'";
				var pass = "'" + passHash + "'";
				var sql = "INSERT INTO cus_user (name, email, phone, password) VALUES (" + name + "," + email + "," + phone + "," + pass + ")";
				
				con.query(sql, (err, result) => {
					if(err) {
						res.send({error: {msg: 'failed to store data'}, result: null});
						logging("SQL_ERR/create_account-validate: " + err.code);
						return;
					}
					sql = "SELECT id FROM cus_user WHERE email=" + "'" + req.body.email + "'";

					con.query(sql, (err, result) => {
						if(err) {
							res.send({error: {msg: 'failed to store data'}, result: null});
							logging("SQL_ERR/create_account-store: " + err.code);
							return;
						}
						user_id = result[0].id;
						res.send(
							{
								error: null, 
								result: {
									id: result[0].id, 
									name: req.body.name, 
									email: req.body.email, 
									phone: req.body.phone,
									favourite: []
								}
							});
					});
				});
			} else {
				res.send({error: {msg: 'user does not exist'}, result: null});
			}
			return;
		}
		if(req.body.login_type && req.body.login_type == "google") {
			password= "google_" + req.body.password;
		} 
		if(!hash.verify(password, result_1[0].password)) {
			res.send({error: {msg: 'wrong password'}, result: null});
			return;
		}

		var sql = "SELECT item_id FROM cus_favourite WHERE user_id =" + "'" + result_1[0].id + "'";
		con.query(sql, (err, result_2) => {
			if(err) {
				res.send({error: {msg: 'failed to verify data'}, result: null});
				logging("SQL_ERR/verify-favourite: " + err.code);
				return;
			}
			res.send(
				{
					error: null, 
					result: {
						id: result_1[0].id, 
						name: result_1[0].name, 
						email: req.body.email, 
						phone: result_1[0].phone,
						favourite: result_2
					}
				});
		});
	});
});

app.post("/place", (req, res) => {
	if(!(req.body.toko_id)) {
		if(!(req.body.category && req.body.latitude && req.body.longitude)) {
			res.send({error: {msg: 'lack of parameter'}, result: null});
			return;
		}

		if(!req.body.low_rad) {
			low_rad = 0;
		} else {
			low_rad = req.body.low_rad;
		}
		if(!req.body.high_rad) {
			high_rad = 1000;
		} else {
			high_rad = req.body.high_rad;
		}
		var sql = "SELECT id, name, img_url, address, description, open_at, close_at, latitude, longitude, phone FROM `cus_toko` WHERE " +
			"category='" + req.body.category + "' AND " +
			"SQRT(" + 
			"(latitude-" + req.body.latitude + ")*(latitude-" + req.body.latitude + ")+" + 
			"(longitude-" + req.body.longitude + ")*(longitude-" + req.body.longitude + "))" + 
			" BETWEEN " + low_rad + " AND " + high_rad +
			" ORDER BY SQRT((latitude-" + req.body.longitude + ")*(latitude-" + req.body.latitude + ")+" + 
			"(longitude-" + req.body.longitude + ")*(longitude-" + req.body.latitude + ")) ASC";
	} else {
		var sql = "SELECT id, name, img_url, address, description, open_at, close_at, latitude, longitude, phone FROM `cus_toko` WHERE " +
			"id=" + req.body.toko_id;
	}

	con.query(sql, (err, result) => {
		if(!err) {
			result.forEach((item, index) => {
				open_at = getTodayTime(result[index].open_at);
				close_at = getTodayTime(result[index].close_at);
				result[index].open_at = open_at;
				result[index].close_at = close_at;
				if (isOperationTime(timeToJSON(open_at), timeToJSON(close_at))) {
					result[index].is_close = false;
				} else {
					result[index].is_close = true;
				}
			});
			res.send({error: null, result});
		} else {
			res.send({error: {msg: 'failed to acquire data'}, result: null});
			logging("SQL_ERR/place: " + err.code);
		}
	});
});

app.post("/getItemList", (req, res) => {
	var sql;
	if(req.body.item_id) {
		sql = "SELECT toko_id, name, price, img_url, description FROM `cus_item` WHERE " + 
			"id='" + req.body.item_id + "'";
	} else {
		sql = "SELECT id, name, price, img_url, description FROM `cus_item` WHERE " + 
			"toko_id='" + req.body.toko_id + "'";
	}
	
	if(req.body.search && req.body.search != "") {
		sql += " AND name LIKE '%" + req.body.search + "%'";
	}
	if(req.body.limit) {
		if(req.body.offset) {
			sql += " LIMIT " + req.body.offset + ", " + req.body.limit;
		} else {
			sql += " LIMIT " + req.body.limit;
		}
	}

	con.query(sql, (err, list_items) => {
		if(!err) {
			sql = "SELECT open_at, close_at FROM `cus_toko` WHERE id='" + req.body.toko_id + "'";
			con.query(sql, (err, place) => {
				if(!err) {
					var open_at = getTodayTime(place[0].open_at);
					var close_at = getTodayTime(place[0].close_at);
					is_close = true;
					if (isOperationTime(timeToJSON(open_at), timeToJSON(close_at))) {
						is_close = false;
					}
					result = {list_items: list_items, is_close: is_close};
					res.send({error: null, result});
				} else {
					res.send({error: {msg: 'failed to acquire data'}, result: null});
					logging("SQL_ERR/item: " + err.code + " " + sql);
				}
			});
		} else {
			res.send({error: {msg: 'failed to acquire data'}, result: null});
			logging("SQL_ERR/item: " + err.code + " " + sql);
		}
	});
});

app.post("/toggleFavItem", (req, res) => {
	if(!(req.body.user_id && req.body.item_id && req.body.is_fav)) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}

	var sql = "SELECT id FROM `cus_user` WHERE id=" + req.body.user_id;
	con.query(sql, (err, result) => {
		if(!err) {
			var check = "SELECT id FROM `cus_favourite` WHERE user_id='" + req.body.user_id + 
				"' AND item_id='" + req.body.item_id + "'";
			con.query(check, (err, result) => {
				if(!err) {
					if(result.length != 0) {
						if(req.body.is_fav == 1) {
							if(!req.body.count) {
								item_count = 0;
							} else {
								item_count = req.body.count;
							}
							var update = "UPDATE cus_favourite SET count='" + item_count + "' WHERE user_id=" + 
								req.body.user_id + " AND item_id=" + req.body.item_id;
							con.query(update, (err, result) => {
								if(!err) {
									res.send({error: null, result: {
										code: 1,
										msg: "wishlist updated"
									}});
								} else {
									res.send({error: {msg: 'failed to update data'}, result: null});
									logging("SQL_ERR/favItem-update: " + err.code);
								}
							});
						} else {
							var del = "DELETE FROM `cus_favourite` WHERE user_id='" + req.body.user_id + 
								"' AND item_id='" + req.body.item_id + "'";
							con.query(del, (err, result) => {
								if(!err) {
									res.send({error: null, result: {
										code: 0,
										msg: "unfavourited"
									}});
								} else {
									res.send({error: {msg: 'failed to delete data'}, result: null});
									logging("SQL_ERR/favItem-delete: " + err.code);
								}
							});
						}
					} else {
						if(req.body.is_fav == 1) {
							var insert = "INSERT INTO cus_favourite (user_id, item_id) VALUES (" + req.body.user_id + "," + req.body.item_id + ")";
							con.query(insert, (err, result) => {
								if(!err) {
									res.send({error: null, result: {
										code: 1,
										msg: "favourited"
									}});
								} else {
									res.send({error: {msg: 'failed to insert data'}, result: null});
									logging("SQL_ERR/favItem-insert: " + err.code);
								}
							});
						} else {
							res.send({error: true, result: {
								code: -1,
								msg: "cannot unfavourite not existing item"
							}});
						}
					}
				} else {
					res.send({error: {msg: 'failed to fetch data'}, result: null});
					logging("SQL_ERR/favItem-fetch: " + err.code);
				}
			});
		} else {
			res.send({error: {msg: 'failed to validate data'}, result: null});
			logging("SQL_ERR/favItem-validate: " + err.code);
		}
	});
});


app.post("/payment/:transaction_id/confirm", (req, res) => {
	if(!(req.body.payment_id)) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}
	var replace = "UPDATE `cus_transaction` SET status=1 WHERE id=" + req.body.payment_id;
	con.query(replace, (err, result) => {
		if(err) {
			res.send({error: {msg: 'failed to change data'}, result: null});
			logging("SQL_ERR/payment-confirmation: " + err.code + " " + replace);
		} else {
			res.send({error: null, result: null});
		}
	});
}); 

app.post("/payment/:transaction_id/delete", delete_transaction);

app.post("/payment/:transaction_id/rate", (req, res) => {
	if(!(req.body.rating)) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}
	var replace = "UPDATE `cus_transaction` SET status=2, rating=" + req.body.rating + " WHERE transaction_id=" + req.params.transaction_id;
	con.query(replace, (err, result) => {
		if(!err) {
			res.send({error: null, result: null});
		} else {
			res.send({error: {msg: 'failed to give rating'}, result: null});
			logging("SQL_ERR/payment-rate: " + err.code + " " + replace);
		}
	});
});

app.post("/getHistory", (req, res) => {
	if(!(req.body.user_id)) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}

	var select;
	if(req.session.authorized != undefined) {
		if(req.body.payment) {
			select = "SELECT id, name, item_quantity, total_price, status, estimation FROM `cus_transaction` " +
				"WHERE transaction_id=" + req.body.transaction_id;
		} else {
			select = "SELECT transaction_id, total_price, created_at, status, estimation FROM " +
				"`cus_transaction`";
			if(req.body.status == "completed") {
				select += " WHERE status=1";
			} else if(req.body.status == "waiting") {
				select += " WHERE status=0";
			}
			if(req.body.transaction_id != "") {
				if(req.body.status == "both") {
					select += " WHERE transaction_id LIKE '%" + req.body.transaction_id + "%'";
				} else {
					select += " AND transaction_id LIKE '%" + req.body.transaction_id + "%'";
				}
			}
			select += " GROUP BY transaction_id";
		}
	} else {
		select = "SELECT * FROM " + "`cus_transaction` WHERE user_id='" + req.body.user_id + "'";
		if(req.body.transaction_id) {
			select += " AND transaction_id='" + req.body.transaction_id + "'";
		}
	}

	select += " ORDER BY id DESC";

	if(req.body.offset && req.body.limit) {
		select += " LIMIT " + req.body.offset + "," + req.body.limit;
	} else if(req.body.limit) {
		select += " LIMIT " + req.body.limit;
	}
	if(req.body.transaction_id) {

	}

	var history_list = [];
	var result_size = 0;
	con.query(select, (err, result) => {
		if(!err) {
			if (req.session.authorized == undefined) {	
				result_size = result.length;		
				var currentTokoId = -1;

				var estimated_json = dateToJSON(transaksi.estimation);
				var transaction_list = [];
				var currentTransactionId = "0";
				var currentTransactionData = {};
				var counter = -1;
				var place_counter = 0;
				var items_counter = 0;
				var send_triggered = false;
				result.forEach((transaksi, index) => {
					if ((transaksi.status == 0) && isExpired(estimated_json, true)) {
						expire_transaction(transaksi.transaction_id);
						transaksi.status = 4;
					}
					if (currentTransactionId != transaksi.transaction_id) {
						counter++;
						currentTransactionId = transaksi.transaction_id;
						currentTransactionData = {
							transaction_id: transaksi.transaction_id,
							created_at: transaksi.created_at, 
							status: status, 
							estimation: estimated_json.hour + ":" + estimated_json.minute,
							rating: transaksi.rating,
							toko: null,
							list_items: []
						}
						transaction_list.push(currentTransactionData);

						var c = counter;
						select = "SELECT name, address, phone, latitude, longitude FROM `cus_toko`" + 
							" WHERE id='" + transaksi.toko_id + "'";
						con.query(select, (err, place) => {
							if(!err) {
								transaction_list[c]['toko'] = place;
								place_counter++;
								if ((items_counter == result.length) && (place_counter == transaction_list.length) && (send_triggered == false)) {
									send_triggered = true;
									res.send({error: null, result: transaction_list});
								}
							} else {
								res.send({error: {msg: 'failed to retrieve data'}, result: null});
								logging("SQL_ERR/getHistory: " + err.code + " " + select);
							}
						});
					}

					var item = {
						id: transaksi.item_id, 
						name: transaksi.name, 
						quantity: transaksi.item_quantity, 
						price: transaksi.total_price
					};
					transaction_list[counter].list_items.push(item);
					items_counter++;

					if ((items_counter == result.length) && (place_counter == transaction_list.length) && (send_triggered == false)) {
						send_triggered = true;
						res.send({error: null, result: transaction_list});
					}
				});
			} else {
				transaction_result = [];
				result.forEach((transaksi, index) => {
					if ((transaksi.status == 0) && isExpired(transaksi.estimation, false)) {
						expire_transaction(transaksi.transaction_id);
						transaksi.status = 4;
					}
					transaction_result.push(transaksi);
					if ((index + 1) == result.length) {
						res.send({error: null, result: transaction_result});
					}
				});	
			}
		} else {
			res.send({error: {msg: 'failed to retrieve data'}, result: null});
			logging("SQL_ERR/getHistory: " + err.code + " " + select);
		}
	});
});

app.get("/getFAQ", (req, res) => {
	if (req.session.authorized == undefined) {
		var select = "SELECT question, answer FROM cus_faq";
	} else {
		var select = "SELECT id, question, answer FROM cus_faq";
	}
	
	con.query(select, (err, result) => {
		if(err) {
			res.send({error: {msg: 'failed to retrieve data'}, result: null});
			logging("SQL_ERR/getFAQ: " + err.code);
		} else {
			res.send({error: null, result: result});
		}
	});
});

app.post("/edit-faq", (req, res) => {
	var answer = req.body.answer.replace(/'/g, "&#39");
	if (req.body.id == -1) {
		var sql = "INSERT INTO `cus_faq` (question, answer) VALUES ('" + req.body.question + "','" + answer + "')";
	} else {
		var sql = "UPDATE `cus_faq` SET answer='" + answer + "' WHERE id=" + req.body.id;
	}
	con.query(sql, (err, result) => {
		if(err) {
			res.send({error: {msg: 'failed to update or insert data'}, result: null});
			logging("SQL_ERR/edit-faq: " + err.code + " " + sql);
		} else {
			var page = "http://" + host[HOST_DOMAIN] + "/faq";
			res.redirect(page);
		}
	});
});

app.post("/faq/:id/delete", (req, res) => {
	var del = "DELETE FROM `cus_faq` WHERE id=" + req.params.id;
	con.query(del, (err, result) => {
		if(err) {
			res.send({error: {msg: 'failed to delete data'}, result: null});
			logging("SQL_ERR/faq-delete: " + err.code);
		} else {
			var page = "http://" + host[HOST_DOMAIN] + "/faq";
			res.redirect(page);
		}
	});
});

function logging(message) {
	fs.appendFile('log.dat', message+"\n", function (err) {
	  if (err) throw err;
	});
}

function formatTime(iHour, iMin) {
	now = (new Date()).getTime();

	if (iHour < (new Date()).getHours()) {
		now = now + 86400000;
	} else if (iHour == (new Date()).getHours()) {
		if (iMin <= (new Date()).getMinutes()) {
			now = now + 86400000;
		}
	} 

	createdAt = new Date(now);
	date = createdAt.getDate() + "-" + createdAt.getMonth() + "-" + createdAt.getFullYear();

	if (iHour >= 10) {
		sHour = iHour.toString();
	} else {
		sHour = "0" + iHour.toString();
	}
	if (iMin >= 10) {
		sMin = iMin.toString();
	} else {
		sMin = "0" + iMin.toString();
	}
	return date + "-" + sHour + ":" + sMin;
}

function getTodayTime(time) {
	t = time.split(",");
	d = ((new Date()).getDay() - 1) % 7;
	return t[d];
}

function isOperationTime(open, close) {
	if (open == close) {
		return false;
	}
	date = new Date();
	h = date.getHours();
	m = date.getMinutes();

	open_h = open.hours;
	open_m = open.minutes;

	close = minusMinute(close, 30);
	close_h = close.hours;
	close_m = close.minutes;

	if ((open_h < h || (open_h == h && open_m <= m)) &&
		(close_h > h || (close_h == h && close_m > m))) {
		return true;
	}
	return false;
}

function minusMinute(time, minus) {
	time.minutes = time.minutes - minus;
	if (time.minutes < 0) {
		time.hours = time.hours - 1;
	}
	time.minutes = time.minutes % 60;
	return time;
}

function dateToJSON(date) {
	dates = date.split("-");

	if (dates.length != 4) {
		return null;
	} else {
		time = dates[3].split(":");
		if (time.length != 2) {
			return null;
		}
		json = {'day': dates[0], 'month': dates[1], 'year': dates[2], 'hour': time[0], 'minute': time[1]};
		return json;
	}
}

function timeToJSON(time) {
	t = time.split(":");
	json = {hours: t[0], minutes: t[1]};
	return json;
}

function isExpired(estimated_time, json) {
	est_json = estimated_time;
	if (!json) {
		est_json = dateToJSON(estimated_time);	
	}
	estimated = new Date(est_json.year, est_json.month, est_json.day, est_json.hour, est_json.minute, 0, 0);
	estimated = new Date(estimated.getTime() + 1800000);
	return (estimated <= (new Date));
}


var RETURN_LIMIT = 3;
var RETURN_COUNTER = 0;
function init() {
	fs.writeFile("log.dat", "", (err) => {
		if(err) {
			console.log("Something wrong!");
		}
			var getTransactionId = "SELECT MAX(transaction_id) as transaction_id FROM `cus_transaction`";
			var getTokoImageId = "SELECT MAX(id) as image_id FROM `cus_toko`";
			var getItemImageId = "SELECT MAX(id) as image_id FROM `cus_item`";
			con.query(getTransactionId, (err, result) => {
				if (err) {
					up("init/getTransactionId: " + err.code + " " + getTransactionId);
				} else {
					idGen.setTransactionId(result[0].transaction_id);
					up();
				}
			});
			con.query(getTokoImageId, (err, result) => {
				if (err) {
					up("init/getTokoImageId: " + err.code + " " + getTokoImageId);
				} else {
					idGen.setTokoImageId(result[0].image_id);
					up();
				}
			});
			con.query(getItemImageId, (err, result) => {
				if (err) {
					up("init/getItemImageId: " + err.code + " " + getTokoImageId);
				} else {
					idGen.setItemImageId(result[0].image_id);
					up();
				}
			});
	});
}

function up(err = null) {
	if (!err) {
		RETURN_COUNTER = RETURN_COUNTER + 1;
		if (RETURN_COUNTER == RETURN_LIMIT) {
			app.listen(3000, () => {
				console.log("Server On!");
			});
		}
	} else {
		throw new Error(err);
	}
}

init();

// async.waterfall([code_one, slowFunction], () => {console.log("Udah!")});

/*
app.use(express.static("public"));

app.get("/output/:title/:name/:id", function(req, res) {
	res.send(req.params.title + " " + req.params.name + " " + req.params.id);
})

app.get("/speak/:animal", function(req, res) {
	if(req.params.animal == "pig") {
		res.send("Oink");
	} else if(req.params.animal == "cow") {
		res.send("Moo");
	} else if(req.params.dog == "dog") {
		res.send("Woof woof!");
	}
})

app.get("/repeat/:words/:n", function(req, res) {
	str = "";
	for(i = 0; i < req.params.n; ++i) {
		str = str + req.params.words + " ";
	}
	res.send(str);
})

app.get("*", function(req, res) {
	res.send("ERROR BRO!");
})
*/