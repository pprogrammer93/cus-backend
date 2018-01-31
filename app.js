var express = require("express");
var fs = require("fs");
var hash = require("password-hash");
var app = express();
var bodyParser = require("body-parser");
var session = require('express-session');
var MySQLStore = require('express-mysql-session');

const HOST_HOST = 0;
const HOST_USER = 1;
const HOST_PASS = 2;
const HOST_PORT = 3;
const HOST_DB = 4;
const HOST_DOMAIN = 5;
const HOST_KEY = 6;

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
var connect_msg = ""
con.connect(function(err) {
	if(!err) {
		connect_msg = "Hi there!";
	} else {
		connect_msg = "Opps! " + err.code;
	}
});
app.get("/", (req, res) => {
	res.send(connect_msg);
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

app.listen(3000, () => {
	console.log("Server On!");
});

app.get("/register-toko", (req, res) => {
	req.session.authorized = true;
	res.render("register-toko.ejs", {domain: host[HOST_DOMAIN]});
});

app.get("/register-user", (req, res) => {
	req.session.authorized = true;
	res.render("register-user.ejs", {domain: host[HOST_DOMAIN]});
});

app.get("/register-item", (req, res) => {
	req.session.authorized = true;
	res.render("register-item-noid.ejs", {domain: host[HOST_DOMAIN]});
});

app.get("/register-item/:id", (req, res) => {
	req.session.authorized = true;
	res.render("register-item.ejs", {domain: host[HOST_MAIN]});
});

app.post("/create-item", (req, res) => {
	logging("REQUEST/create-item: body{" + JSON.stringify(req.body) + "}, " + "header{" + JSON.stringify(req.headers) + "}");
	if(!req.headers.authorization == host[HOST_KEY] || req.session.authorized == false) {
		res.send({error: {msg: 'unauthorized'}, result: null});
		return;
	}
	if(!(req.body.toko_id && req.body.name && req.body.price)) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}

	var description = "-";
	if(req.body.description) {
		description = req.body.description;
	}
	var hrTime = process.hrtime();
	var img_id = hrTime[0].toString() + hrTime[1].toString();
	var img_url = "http://" + host[HOST_DOMAIN] + "/img/item/" + req.body.toko_id + "/" + img_id + "_" + req.body.name;

	var insert = "INSERT INTO cus_item (toko_id, name, price, description, img_url) " + 
		"VALUES ('" + req.body.toko_id + "','" + req.body.name + "','" + req.body.price + "','" + description +
		"','" + img_url + "')";

	con.query(insert, (err, result) => {
		if(err) {
			res.send({error: {msg: 'failed to store data'}, result: null});
			logging("SQL_ERR/create_item-insert: " + err.code);
			return;
		}
		res.send({error: null, result: null});
	});
});

app.post("/create-toko", (req, res) => {
	logging("REQUEST/create-toko: body{" + JSON.stringify(req.body) + "}, " + "header{" + JSON.stringify(req.headers) + "}");
	if(!req.headers.authorization == host[HOST_KEY] || req.session.authorized == false) {
		res.send({error: {msg: 'unauthorized'}, result: null});
		return;
	}
	if(!(req.body.name && req.body.address && req.body.open_at &&
			req.body.close_at && req.body.latitude && req.body.longitude && 
			req.body.phone && req.body.category)) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}
	var description = "-";
	if(req.body.description) {
		description = req.body.description;
	}

	var hrTime = process.hrtime();
	var img_id = hrTime[0].toString() + hrTime[1].toString();
	var img_url = "http://" + host[HOST_DOMAIN] + "/img/toko/" + img_id + "_" + req.body.name;

	var insert = "INSERT INTO cus_toko (name, address, category, description, img_url, open_at, close_at, latitude, longitude, phone) " + 
		"VALUES ('" + req.body.name + "','" + req.body.address + "','" + req.body.category + "','" + description + "','" + img_url +
		"','" + req.body.open_at + "','" + req.body.close_at + "','" + req.body.latitude + "','" + req.body.longitude + 
		"','" + req.body.phone + "')";

	con.query(insert, (err, result) => {
		if(err) {
			res.send({error: {msg: 'failed to store data'}, result: null});
			logging("SQL_ERR/create_toko-insert: " + err.code);
			return;
		}
		res.send({error: null, result: null});
	});
});

app.post("/edit-account", (req,res) => {
	logging("REQUEST/edit-account: body{" + JSON.stringify(req.body) + "}, " + "header{" + JSON.stringify(req.headers) + "}");
	if(!req.headers.authorization == host[HOST_KEY] || req.session.authorized == false) {
		res.send({error: {msg: 'unauthorized'}, result: null});
		return;
	}
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

		if(req.body.current_password == null ^ req.body.password_1 == null ^ req.body.password_2 == null) {
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
		} else {
			if(req.body.current_password != null) {
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
	logging("REQUEST/edit-account: body{" + JSON.stringify(req.body) + "}, " + "header{" + JSON.stringify(req.headers) + "}");
	if(!req.headers.authorization == host[HOST_KEY] || req.session.authorized == false) {
		res.send({error: {msg: 'unauthorized'}, result: null});
		return;
	}
	if(!req.body.user_id) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}
	if(!req.body.item_list) {
		return;
	}

	var pending_purchase = [];
	var hrTime = process.hrtime();
	var transaction_id = hrTime[0].toString() + hrTime[1].toString();
	var time = new Date();
	var created_at = time.getDate + "-" + (time.getMonth() + 1) + "-" + time.getFullYear() + "-" + time.getHours + ":" + time.getMinutes(); 

	item_list = req.body.item_list;
	item_list.forEach((item, index) => {
		if(!(item.toko_id && item.item_id && item.item_quantity && item.total_price)) {
			item.msg = "lack of data";
			pending_purchase.push(item);
		} else {
			var insert = "INSERT INTO cus_transaction (transaction_id, user_id, toko_id, item_id, item_quantity, total_price, created_at) " +
				"VALUES ('"+transaction_id+"','"+req.body.user_id+"','"+item.toko_id+"','"+item.item_id+"','"+ 
				item.item_quantity+"','"+item.total_price+"','"+created_at+"')";
			console.log(insert);
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
	logging("REQUEST/create-account: body{" + JSON.stringify(req.body) + "}, " + "header{" + JSON.stringify(req.headers) + "}");
	if(!req.headers.authorization == host[HOST_KEY] || req.session.authorized == false) {
		res.send({error: {msg: 'unauthorized'}, result: null});
		return;
	}
	if(!(req.body.name && req.body.email && req.body.phone && req.body.password_1 && req.body.password_2)) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
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
	logging("REQUEST/verify: body{" + JSON.stringify(req.body) + "}, " + "header{" + JSON.stringify(req.headers) + "}");
	if(req.headers.authorization != host[HOST_KEY]) {
		res.send({error: {msg: 'unauthorized'}, result: null});
		return;
	}
	if(!(req.body.email && req.body.password)) {
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
			res.send({error: {msg: 'user does not exist'}, result: null});
			return;
		}
		if(!hash.verify(req.body.password, result_1[0].password)) {
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
	logging("REQUEST/place: body{" + JSON.stringify(req.body) + "}, " + "header{" + JSON.stringify(req.headers) + "}");
	if(req.headers.authorization != host[HOST_KEY]) {
		res.send({error: {msg: 'unauthorized'}, result: null});
		return;
	}
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

	con.query(sql, (err, result) => {
		if(!err) {
			res.send({error: null, result});
		} else {
			res.send({error: {msg: 'failed to acquire data'}, result: null});
			logging("SQL_ERR/place: " + err.code);
		}
	});
});

app.post("/getItemList", (req, res) => {
	logging("REQUEST/getItemList: body{" + JSON.stringify(req.body) + "}, " + "header{" + JSON.stringify(req.headers) + "}");
	if(req.headers.authorization != host[HOST_KEY]) {
		res.send({error: {msg: 'unauthorized'}, result: null});
		return;
	}
	if(!(req.body.toko_id)) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}

	var sql = "SELECT id, name, price, img_url, description FROM `cus_item` WHERE " + 
		"toko_id='" + req.body.toko_id + "'";
	con.query(sql, (err, result) => {
		if(!err) {
			res.send({error: null, result});
		} else {
			res.send({error: {msg: 'failed to acquire data'}, result: null});
			logging("SQL_ERR/item: " + err.code);
		}
	});
});

app.post("/toggleFavItem", (req, res) => {
	logging("REQUEST/toggleFavItem: body{" + JSON.stringify(req.body) + "}, " + "header{" + JSON.stringify(req.headers) + "}");
	if(req.headers.authorization != host[HOST_KEY]) {
		res.send({error: {msg: 'unauthorized'}, result: null});
		return;
	}
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

function logging(message) {
	fs.appendFile('log.dat', message+"\n", function (err) {
	  if (err) throw err;
	});
}

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