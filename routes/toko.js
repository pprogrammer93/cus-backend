var express = require('express');
var host = require('../scripts/host');
var utils = require('../scripts/utils');
var idGen = require('../scripts/id-gen');
var fse = require('fs-extra');
var app = express.Router();
var multer  = require('multer')
var upload = multer({dest: "img/temp"})
var logging = utils.logging;

app.get("/:toko_id/register-item", (req, res) => {
	req.session.authorized = true;
	res.render("register-item.ejs", {domain: host.DOMAIN, toko_id: req.params.toko_id, dir: host.DIR});
});

app.get("/:id", (req, res) => {
	req.session.authorized = true;
	res.render("toko.ejs", {id: req.params.id, domain: host.DOMAIN, dir: host.DIR});
});

app.get("/:toko_id/item/:id", (req, res) => {
	req.session.authorized = true;
	res.render("item.ejs", {toko_id: req.params.toko_id, id: req.params.id, domain: host.DOMAIN, dir: host.DIR});
});

app.post("/get", (req, res) => {
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

	host.con.query(sql, (err, result_1) => {
		if(!err) {
			if(req.body.count && !req.body.toko_id) {
				if(req.body.search) {
					sql = "SELECT id FROM `cus_toko` + WHERE name LIKE '%" + req.body.search + "%' OR address LIKE '%" +
						req.body.search + "%'";
				} else {
					sql = "SELECT id FROM `cus_toko`";
				}
				host.con.query(sql, (err, result_2) => {
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

app.post("/:toko_id/create-item", upload.single("image"), (req, res) => {	
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
		img_url = "http://" + host.DIR + "/" + img_storage;

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
	
	host.con.query(insert, (err, result) => {
		if(err) {
			res.send({error: {msg: 'failed to store data'}, result: null});
			logging("SQL_ERR/create_item-insert: " + err.code);
			fs.unlink(img_storage, function (err) {
			 	logging("IMAGE/create_item-insert: " + err.code + " " + img_storage + " Need to erase image manually.");
			});
			return;
		}
		if(req.body.edit) {
			var page = "http://" + host.DOMAIN + "/" + "toko/" + req.params.toko_id + "/item/" + req.body.item_id;
			res.redirect(page);
		} else if (req.session.authorized != undefined) {
			var page = "http://" + host.DOMAIN + "/" + "toko/" + req.params.toko_id;
			res.redirect(page);
		} else {
			res.send({error: null, result: null});
		}
	});
});

app.post("/:id/delete", (req, res) => {
	var select = "SELECT img_url FROM `cus_toko` WHERE id='" + req.params.id + "'";
	host.con.query(select, (err, result) => {
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
			host.con.query(del, (err, result) => {
					if(err) {
						res.send({error: {msg: 'failed to delete data toko'}, result: null});
						logging("SQL_ERR/delete-toko: " + err.code);
					} else { 
						var page = "http://" + host.DOMAIN;
						res.redirect(page);
					}
				});
		} else {
			res.send({error: {msg: 'failed to retrieve img_url'}, result: null});
			logging("SQL_ERR/delete-toko: " + err.code);
		}
	});
});

app.post("/:toko_id/item/:id/delete", (req, res) => {
	var select = "SELECT img_url FROM `cus_item` WHERE id='" + req.params.id + "'";
	host.con.query(select, (err, result) => {
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
			host.con.query(del, (err, result) => {
				if(err) {
					res.send({error: {msg: 'failed to delete data item'}, result: null});
					logging("SQL_ERR/delete-item: " + err.code);
				} else {
					var page = "http://" + host.DOMAIN + /toko/ + req.params.toko_id;
					res.redirect(page);
				}
			});
		}
	});
});

module.exports = app;