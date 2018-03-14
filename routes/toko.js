const TOKO_IMAGE_DIR = "img/toko";
const TEMP_IMAGE_DIR = "img/temp";
const ITEM_IMAGE_DIR = "img/item";

var express = require('express');
var host = require('../scripts/host');
var utils = require('../scripts/utils');
var idGen = require('../scripts/id-gen');
var fse = require('fs-extra');
var app = express.Router();
var multer  = require('multer')
var upload = multer({dest: "img/temp"})
var fs = require("fs");
var logging = utils.logging;
var sql = require('../scripts/sql-builder/sql-builder');

var getTodayTime = function(time) {
	t = time.split(",");
	d = ((new Date()).getDay() - 1) % 7;
	return t[d];
}

var saveImage = function(tempImagePath, newImagePath) {
	return new Promise((resolve, reject) => {
		fs.rename(tempImagePath, newImagePath, function (err) {
			if (err) {
				new Promise(resolve => {
					logging("IMAGE/toko: failed to move from " + tempImagePath + " to " + newImagePath);
					resolve();
				}).then(() => {
					resolve(err == null);
				});
			} else {
				resolve(err == null);
			}
		});
	});
};

var removeImage = function(imagePath) {
	return new Promise((resolve, reject) => {
		fs.unlink(imagePath, function (err) {
			if (err) {
				new Promise(resolve => {
					logging("IMAGE/toko: unable to remove " + imagePath);
					resolve();
				}).then(() => {
					resolve(err == null);
				});
			} else {
				resolve(err == null);
			}
		});
	});
}

var sqlQuery = function(query) {
	return new Promise((resolve, reject) => {
		host.con.query(query.build(), (err, result) => {
			if (err) {
				new Promise(resolve => {
					logging("SQL_ERR/toko: " + err.code + " " + query.build());
					resolve();
				}).then(() => {
					reject(err);
				});
			} else {
				resolve(result);
			}
		});
	});
}

function minusMinute(time, minus) {
	time.minutes = time.minutes - minus;
	if (time.minutes < 0) {
		time.hours = time.hours - 1;
	}
	time.minutes = time.minutes % 60;
	return time;
}

function timeToJSON(time) {
	t = time.split(":");
	json = {hours: t[0], minutes: t[1]};
	return json;
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

app.get("/register", (req, res) => {
	req.session.authorized = true;
	res.render("register-toko.ejs", {domain: host.DOMAIN, dir: host.DIR});
});

app.get("/:toko_id/item/register", (req, res) => {
	req.session.authorized = true;
	res.render("register-item.ejs", {domain: host.DOMAIN, toko_id: req.params.toko_id, dir: host.DIR});
});

app.get("/:toko_id", (req, res) => {
	req.session.authorized = true;
	res.render("toko.ejs", {id: req.params.toko_id, domain: host.DOMAIN, dir: host.DIR});
});

app.get("/:toko_id/item/:id", (req, res) => {
	req.session.authorized = true;
	res.render("item.ejs", {toko_id: req.params.toko_id, id: req.params.id, domain: host.DOMAIN, dir: host.DIR});
});

app.post("/get", (req, res) => {
	var tokoId = req.body.toko_id;
	var offset = req.body.offset;
	var limit = req.body.limit;
	var search = req.body.search;

	var query = sql.make_sql(sql.SELECT, 'cus_toko')
		.addFields('toko_id, name, img_type, address, description, category, open_at, close_at, latitude, longitude, phone')
		.setOrder('toko_id', sql.DESC);
	if (tokoId != null) {
		query.setCondition('toko_id', sql.EqualTo, tokoId);
	}
	if (offset != null && limit != null) {
		query.setLimit(offset, limit);
	} else if (limit != null) {
		query.setLimit(offset);
	} else if (offset != null) {
		query.setLimit(offset, 10);
	} else {
		query.setLimit(0, 10);
	}
	if (search != null && search.length != 0) {
		query.addCondition(
			sql.AND,
			sql.make_cond(
				sql.make_cond('name', sql.LIKE, '%'+search.trim()+'%'),
				sql.OR,
				sql.make_cond('address', sql.LIKE, '%'+search.trim()+'%')
			)
		);
	}

	host.con.query(query.build(), (err, result) => {
		if(!err) {
			result.forEach((toko, index) => {
				if (toko.img_type == null || toko.img_type.length == 0) {
					result[index].img_url = null;
				} else {
					result[index].img_url = utils.build_scheme(
						'http://dirdomain/dir/file_name.extension', 
						['http', host.DIR, TOKO_IMAGE_DIR, toko.toko_id, toko.name.replace(/ /g, '_'), toko.img_type]
					);
				}
			});
			res.send({error: null, result: result});
		} else {
			res.send({error: {msg: 'failed to acquire data'}, result: null});
			logging("SQL_ERR/toko/get: " + err.code + " " + query.build());
		}
	});
});

app.post("/create", upload.single("image"), (req, res) => {
	var toko = req.body;
	var requirement = [toko.name, toko.address, toko.open_at, toko.close_at, toko.latitude, toko.longitude, toko.phone, toko.category];
	if (utils.null_check(requirement)) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}

	var name = toko.name;
	var address = toko.address;
	var openAt = toko.open_at;
	var closeAt = toko.close_at;
	var latitude = toko.latitude;
	var longitude = toko.longitude;
	var phone = toko.phone;
	var category = toko.category;
	var image = req.file;
	if(req.body.description) {
		var description = req.body.description;
	} else {
		var description = '-';
	}

	if(image != null) {
		if (image.size > (4 * 1024 * 1024)) {
			res.send({error: {msg: 'image too large'}, result: null});
			return;
		}
		var imageType = utils.parse_scheme('name.extension', image.originalname).extension;
	} else {
		var imageType = "";
	}

	var createDir = function(newDir) {
		return new Promise((resolve, reject) => {
			fs.mkdir(newDir, (err) => {
				resolve(err == null);
			});
		});
	};

	var deleteDir = function(newDir) {
		return new Promise((resolve, reject) => {
			var newDir = ITEM_IMAGE_DIR + "/" + result.insertId;;
			fse.remove(newDir, (err) => {
				if (err) {
					res.send({error: {msg: 'failed to delete data'}, result: null});
					logging("IMAGE/toko/create: " + err.code + " Need to erase folder manually.");
					reject(false);
				} else {
					resolve(true);
				}
			});
		});
	};

	var deleteRow = function() {
		return new Promise((resolve, reject) => {
			var query = sql.make_sql(sql.DELETE, 'cus_toko').setCondition('toko_id', sql.EqualTo, result.insertId);
			host.con.query(query.build(), (err, result) => {
				if (err) {
					res.send({error: {msg: 'failed to delete data'}, result: null});
			 		logging("SQL_ERR/toko/create: " + err.code + " " + query.build() + " Need to delete row manually.");
			 		resolve(false);
				} else {
					resolve(true);
				}
			});
		});
	};

	var createNewToko = async () => {
		var query = sql.make_sql(sql.INSERT, 'cus_toko')
			.addFields('name, address, category, description, img_type, open_at, close_at, latitude, longitude, phone')
			.addValues([name, address, category, description, imageType, openAt, closeAt, latitude, longitude, phone]);
		var result = await sqlQuery(query).catch(err => res.send({error: {msg: 'failed to create toko'}, result: null}));
		if (result == null) return;
		var newDir = ITEM_IMAGE_DIR + "/" + result.insertId;
		if (await createDir(newDir)) {
			if(image != null) {
				var tempImagePath = utils.build_scheme(
					'direktori/file',
					[TEMP_IMAGE_DIR, image.filename]
				);
				var newImagePath = utils.build_scheme(
					'direktori/id_name.extension',
					[TOKO_IMAGE_DIR, result.insertId, name.replace(/ /g, '_'), imageType]);
				if (await saveImage(tempImagePath, newImagePath)) {
					if(req.session.authorized != undefined) {
						res.redirect("http://" + host.DOMAIN);
					} else {
						res.send({error: null, result: null});
					}
				} else {
					res.send({error: {msg: 'failed to delete data'}, result: null});
					logging("IMAGE/toko/create: " + err.code + " from " + tempImagePath + " to " + newImagePath);
					var cleaningResult = await Promise.all([deleteRow(), deleteDir(newDir)])
					var cleaningSuccess = true;
					cleanSuccess.forEach((value, index) => {
						if (cleanSuccess) {
							cleanSuccess = value;
						}
					});	
					if (cleanSuccess) {
						if (await deleteRow()) {
							res.send({error: {msg: 'failed to save image'}, result: null});
							logging("FILE/toko/create: " + err.code + ' from ' + tempImagePath + " to " + newImagePath);
						}
					}
				}
			} else {
				if (!(req.session.authorized == undefined)) {
					res.redirect('http://' + host.DOMAIN);
				} else {
					res.send({error: null, result: null});
				}
			}
		} else {
			if (await deleteRow()) {
				res.send({error: {msg: 'failed to create toko directory'}, result: null});
				logging("FILE/toko/create: " + err.code + " " + newDir);
			}
		}
	};

	createNewToko().catch((err) => console.log(err));
});

app.post('/:toko_id/edit', upload.single("image"), (req, res) => {
	var toko = req.body;
	var requirement = [toko.name, toko.address, toko.open_at, toko.close_at, toko.latitude, toko.longitude, toko.phone, toko.category];
	if (utils.null_check(requirement)) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}

	var tokoId = req.params.toko_id;
	var name = toko.name;
	var address = toko.address;
	var openAt = toko.open_at;
	var closeAt = toko.close_at;
	var latitude = toko.latitude;
	var longitude = toko.longitude;
	var phone = toko.phone;
	var category = toko.category;
	var image = req.file;
	var imgUrl = req.body.img_url;
	if(req.body.description) {
		var description = req.body.description;
	} else {
		var description = '-';
	}

	if(image != null) {
		if (image.size > (4 * 1024 * 1024)) {
			res.send({error: {msg: 'image too large'}, result: null});
			return;
		}
		var imageType = utils.parse_scheme('name.extension', image.originalname).extension;
	} else {
		if (imgUrl != null && imgUrl.length != 0) {
			var imageType = utils.parse_extension(imgUrl);
		} else {
			var imageType = "";
		}
	}

	var editToko = async () => {
		var query = sql.make_sql(sql.SELECT, 'cus_toko')
			.addFields('name, img_type')
			.setCondition('toko_id', sql.EqualTo, tokoId);
		var result = await sqlQuery(query).catch(err => {
			res.send({error: {msg: 'failed to edit toko'}, result: null});
		});
		if (result == undefined) return;
		var oldName = result[0].name.replace(/ /g, '_');
		var oldImageType = result[0].img_type;

		var query = sql.make_sql(sql.UPDATE, 'cus_toko')
			.addFields('name, address, category, description, img_type, open_at, close_at, latitude, longitude, phone')
			.addValues([name, address, category, description, imageType, openAt, closeAt, latitude, longitude, phone])
			.setCondition('toko_id', sql.EqualTo, tokoId);
		var result = await sqlQuery(query).catch((err) => {
			res.send({error: {msg: 'failed to edit toko'}, result: null});
		});
		if (result == undefined) return;

		var oldImage = utils.build_scheme(
			'direktori/id_name.extension',
			[TOKO_IMAGE_DIR, tokoId, oldName , oldImageType]
		);
		var newName = name.replace(/ /g, '_');
		var newImage = utils.build_scheme(
			'direktori/id_name.extension',
			[TOKO_IMAGE_DIR, tokoId, newName, imageType]
		);

		if (image == null) {
			if ((imageType.length != 0) && (name != oldName)) {
				var imageSaveResult = await saveImage(oldImage, newImage);
			}
		} else {
			var removeImageResult = await removeImage(oldImage);
			var tempImage = utils.build_scheme(
				'direktori/file',
				[TEMP_IMAGE_DIR, image.filename]
			);
			var imageSaveResult = await saveImage(tempImage, newImage);
		}	
		if (req.session.authorized != undefined) {
			res.redirect("http://" + host.DOMAIN + "/toko/" + tokoId);
		} else {
			res.send({error: null, result: null});
		}
	}

	editToko().catch((err) => console.log("Unhandled error: " + err));
});

app.post("/:toko_id/item/create", upload.single("image"), (req, res) => {	
	if(utils.null_check([req.body.name, req.body.price])) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}

	var tokoId = req.params.toko_id;
	var image = req.file;
	var name = req.body.name;
	var price = req.body.price;
	if(req.body.description) {
		var description = req.body.description;
	} else {
		var description = "-";
	}

	if(image != null) {
		if (image.size > (4 * 1024 * 1024)) {
			res.send({error: {msg: 'image too large'}, result: null});
			return;
		}
		var imageType = utils.parse_scheme('name.extension', image.originalname).extension;
	} else {
		var imageType = "";
	}

	var createNewItem = async () => {
		var query = sql.make_sql(sql.INSERT, 'cus_item')
			.addFields('toko_id, name, price, description, img_type')
			.addValues([tokoId, name, price, description, imageType])
		var result = await sqlQuery(query).catch((err) => {
			res.send({error: {msg: 'failed to store data'}, result: null});
		});
		if (result == undefined) return;
		var saveImageResult = true;
		if(image != null) {
			var tempImagePath = utils.build_scheme(
				'direktori/file', 
				[TEMP_IMAGE_DIR, image.filename]
			);
			var newImagePath = utils.build_scheme(
				'direktori/toko/id_name.extension',
				[ITEM_IMAGE_DIR, tokoId, result.insertId, name.replace(/ /g, '_'), imageType]
			);
			var saveImageResult = await saveImage(tempImagePath, newImagePath);
		}
		if (saveImageResult) {
			if (req.session.authorized != undefined) {
				res.redirect("http://" + host.DOMAIN + "/" + "toko/" + tokoId);
			} else {
				res.send({error: null, result: null});
			}
		}
	};

	createNewItem().catch((err) => console.log(err));
});

app.post("/:toko_id/delete", (req, res) => {
	var tokoId = req.params.toko_id;
	var query = sql.make_sql(sql.SELECT, 'cus_toko').addFields('img_type, name').setCondition('toko_id', sql.EqualTo, tokoId);
	host.con.query(query.build(), (err, result) => {
		if(!err) {
			if (result[0].img_type != "") {
				var imagePath = utils.build_scheme(
					'direktori/id_name.extension', 
					[TOKO_IMAGE_DIR, tokoId, result[0].name.replace(/ /g,'_'), result[0].img_type]);
				fs.unlink(imagePath, (err) => {
					if(err) {
						logging("IMAGE/toko/"+tokoId+"/delete: " + err.code + " unable to remove " + imagePath);
					}
				});
			}
			var imageItemsPath = ITEM_IMAGE_DIR + "/" + tokoId;
			fse.remove(imageItemsPath, (err) => {
				if (err) {
					logging("IMAGE/toko/"+tokoId+"/delete: " + err.code + " Need to erase folder " + img_items + " manually.");
				}
			});
			var query = sql.make_sql(sql.DELETE, 'cus_toko').setCondition('toko_id', sql.EqualTo, tokoId);
			host.con.query(query.build(), (err, result) => {
				if(err) {
					res.send({error: {msg: 'failed to delete data toko'}, result: null});
					logging("SQL_ERR/toko/"+tokoId+"/delete: " + err.code + " " + query.build());
				} else { 
					res.redirect("http://" + host.DOMAIN);
				}
			});
		} else {
			res.send({error: {msg: 'failed to retrieve toko data'}, result: null});
			logging("SQL_ERR/toko/"+tokoId+"/delete: " + err.code + " " + query.build());
		}
	});
});

app.post("/:toko_id/item/:item_id/delete", (req, res) => {
	var tokoId = req.params.toko_id;
	var itemId = req.params.item_id;

	var query = sql.make_sql(sql.SELECT, 'cus_item').addFields('img_type, name').setCondition('item_id', sql.EqualTo, itemId);
	host.con.query(query.build(), (err, result) => {
		if(err) {
			res.send({error: {msg: 'failed to retrieve item data'}, result: null});
			logging("SQL_ERR/toko/"+tokoID+"/item/"+itemId+"/delete: " + err.code + " " + query.build);
		} else {
			if (result[0].img_type != "") {
				var imagePath = utils.build_scheme(
					'direktori/toko/id_name.extension',
					[ITEM_IMAGE_DIR, tokoId, itemId, result[0].name, result[0].img_type]);
				fs.unlink(imagePath, (err) => {
					if(err) {
						logging("IMAGE/toko/"+tokoId+"/item/"+itemId+"/delete: " + err.code + " Need to erase image manually.");
					}
				});
			}
			var query = sql.make_sql(sql.DELETE, 'cus_item').setCondition('item_id', sql.EqualTo, itemId);
			host.con.query(query.build(), (err, result) => {
				if (err) {
					res.send({error: {msg: 'failed to delete data item'}, result: null});
					logging("SQL_ERR/toko/"+tokoID+"/item/"+itemId+"/delete: " + err.code + " " + query.build());
				} else {
					res.redirect("http://" + host.DOMAIN + /toko/ + tokoId);
				}
			});
		}
	});
});

app.post('/:toko_id/item/:item_id/edit', upload.single("image"), (req, res) => {
	if(utils.null_check([req.body.name, req.body.price])) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}

	var tokoId = req.params.toko_id;
	var image = req.file;
	var name = req.body.name;
	var price = req.body.price;
	var itemId = req.params.item_id;
	var imgUrl = req.body.img_url;

	if(req.body.description) {
		var description = req.body.description;
	} else {
		var description = "-";
	}

	if(image != null) {
		if (image.size > (4 * 1024 * 1024)) {
			res.send({error: {msg: 'image too large'}, result: null});
			return;
		}
		var imageType = utils.parse_scheme('name.extension', image.originalname).extension;
	} else {
		if (imgUrl != null && imgUrl.length != 0) {
			var imageType = utils.parse_extension(imgUrl);
		} else {
			var imageType = "";
		}
	}

	var editItem = async () => {
		var query = sql.make_sql(sql.SELECT, 'cus_item')
			.addFields('name, img_type')
			.setCondition('item_id', sql.EqualTo, itemId);
		var result = await sqlQuery(query).catch((err) => res.send({error: {msg: 'failed to edit data'}, result: null}));
		if (result == undefined) return;
		var oldName = result[0].name.replace(/ /g, '_');
		var oldImageType = result[0].img_type;

		var query = sql.make_sql(sql.UPDATE, 'cus_item')
			.addFields('toko_id, name, price, description, img_type')
			.addValues([tokoId, name, price, description, imageType])
			.setCondition('item_id', sql.EqualTo, itemId);
		var result = await sqlQuery(query).catch((err) => res.send({error: {msg: 'failed to edit data'}, result: null}));
		if (result == undefined) return;

		var oldImage = utils.build_scheme(
			'direktori/toko/id_name.extension',
			[ITEM_IMAGE_DIR, tokoId, itemId, oldName, oldImageType]
		);
		var newName = name.replace(/ /g, '_');
		var newImage = utils.build_scheme(
			'direktori/toko/id_name.extension',
			[ITEM_IMAGE_DIR, tokoId, itemId, newName, imageType]
		);

		if (image == null) {
			if ((imageType.length != 0) && (name != oldName)) {
				var imageSaveResult = await saveImage(oldImage, newImage);
			}
		} else {
			var removeImageResult = await removeImage(oldImage);
			var tempImage = utils.build_scheme(
				'direktori/file',
				[TEMP_IMAGE_DIR, image.filename]
			);
			var imageSaveResult = await saveImage(tempImage, newImage);
		}	

		if (req.session.authorized != undefined) {
			res.redirect("http://" + host.DOMAIN + "/toko/" + tokoId + "/item/" + itemId);
		} else {
			res.send({error: null, result: null});
		}
	};

	editItem().catch((err) => console.log(err));
});

app.post("/explore", (req, res) => {
	var requirement = [req.body.latitude, req.body.longitude];
	if (utils.null_check(requirement)) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}

	var category = req.body.category;
	var latitude = req.body.latitude;
	var longitude = req.body.longitude;
	if(req.body.low_rad == null) {
		var lowRad = 0;
	} else {
		var lowRad = req.body.low_rad;
	}
	if(req.body.high_rad == null) {
		var highRad = 1000;
	} else {
		var highRad = req.body.high_rad;
	}
	var expression = utils.build_scheme(
		'operation((x1-x2)*(x1-x2)+(y1-y2)*(y1-y2))',
		['SQRT', 'latitude', latitude, 'latitude', latitude, 'longitude', longitude, 'longitude', longitude]
	);
	var query = sql.make_sql(sql.SELECT, 'cus_toko')
		.addFields('toko_id, name, img_type, address, description, open_at, close_at, latitude, longitude, phone')
		.addCondition(sql.AND, sql.make_cond(expression, sql.BETWEEN, lowRad, highRad))
		.setOrder(expression, sql.ASC);
	if (category != null) {
		query = query.addCondition(sql.AND, sql.make_cond('category', sql.EqualTo, category));
	}
	host.con.query(query.build(), (err, result) => {
		if (!err) {
			result.forEach((toko, index) => {
				var openAt = getTodayTime(result[index].open_at);
				var closeAt = getTodayTime(result[index].close_at);
				result[index].open_at = openAt;
				result[index].close_at = closeAt;
				result[index].img_url = utils.build_scheme(
					'http://dirdomain/direktori/id_name.extension',
					['http', host.DIR, TOKO_IMAGE_DIR, toko.toko_id, toko.name, toko.img_type]
				);
				result[index].is_close = !isOperationTime(timeToJSON(openAt), timeToJSON(closeAt));
			});
			res.send({error: null, result});
		} else {
			res.send({error: {msg: 'failed to acquire data'}, result: null});
			logging("SQL_ERR/toko/explore: " + err.code + " " + query.build());
		}
	});
});

app.post("/:toko_id/item", (req, res) => {
	var tokoId = req.params.toko_id;
	var itemId = req.body.item_id;
	var search = req.body.search;
	var offset = req.body.offset;
	var limit = req.body.limit;

	var query = sql.make_sql(sql.SELECT, 'cus_item');
	if(itemId != null) {
		query.addFields('item_id, name, price, img_type, description').setCondition('item_id', sql.EqualTo,itemId);
	} else {
		query.addFields('item_id, name, price, img_type, description').setCondition('toko_id', sql.EqualTo, tokoId);
	}
	if(search != null && search.length != 0) {
		query.addCondition(sql.AND, sql.make_cond('name', sql.LIKE, '%' + search + '%'));
	}
	if(limit != null) {
		if(offset != null) {
			query.setLimit(offset, limit);
		} else {
			query.setLimit(limit);
		}
	}

	host.con.query(query.build(), (err, list_items) => {
		if(!err) {
			list_items.forEach((item, index) => {
				if (item.img_type != null) {
					list_items[index].img_url = utils.build_scheme(
						'http://dirdomain/direktori/toko/id_name.extension',
						['http',host.DIR, ITEM_IMAGE_DIR, tokoId, item.item_id, item.name.replace(/ /g, '_'), item.img_type]
					);
				} else {
					list_items[index].img_url;
				}
			});

			query = sql.make_sql(sql.SELECT, 'cus_toko')
				.addFields('open_at, close_at')
				.setCondition('toko_id',sql.EqualTo, tokoId);
			host.con.query(query.build(), (err, place) => {
				if(!err) {
					var isClose = !isOperationTime(
						timeToJSON(getTodayTime(place[0].open_at)), 
						timeToJSON(getTodayTime(place[0].close_at)));
					result = {list_items: list_items, is_close: isClose};
					res.send({error: null, result});
				} else {
					res.send({error: {msg: 'failed to acquire data'}, result: null});
					logging("SQL_ERR/toko/"+tokoId+"/item: " + err.code + " " + query.build());
				}
			});
		} else {
			res.send({error: {msg: 'failed to acquire data'}, result: null});
			logging("SQL_ERR/toko/"+tokoId+"/item: " + err.code + " " + query.build());
		}
	});
});

app.post("/toggle-favourite", (req, res) => {
	var requirement = [req.body.user_id, req.body.item_id, req.body.is_fav];
	if(utils.null_check(requirement)) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}

	var userId = req.body.user_id;
	var itemId = req.body.item_id;
	var isFav = req.body.is_fav;
	if (req.body.item_count != null) {
		var itemCount = req.body.item_count;
	} else {
		var itemCount = 0;
	}

	var validateUser = function() {
		return new Promise((resolve, reject) => {
			var query = sql.make_sql(sql.SELECT, 'cus_user')
				.addFields('user_id')
				.setCondition('user_id', sql.EqualTo, userId);
			host.con.query(query.build(), (err, result) => {
				if (!err) {
					resolve(result.length);
				} else {
					res.send({error: {msg: 'failed to validate data'}, result: null});
					logging("SQL_ERR/toggle-favourite: " + err.code + " " + query.build());
					resolve(false);
				}
			});
		});
	};
	var newFavourite = function() {
		return new Promise((resolve, reject) => {
			var query = sql.make_sql(sql.INSERT, 'cus_favourite')
				.addFields('user_id, item_id')
				.addValues([userId, itemId])
			host.con.query(query.build(), (err, result) => {
				if(!err) {
					res.send({error: null, result: {
						code: 1,
						msg: "favourited"
					}});
					resolve(true);
				} else {
					res.send({error: {msg: 'failed to insert data'}, result: null});
					logging("SQL_ERR/toggle-favourite: " + err.code + " " + query.build());
					resolve(false);
				}
			});
		});
	};
	var deleteFavourite = function() {
		return new Promise((resolve, reject) => {
			var query = sql.make_sql(sql.DELETE, 'cus_favourite')
				.setCondition(
					sql.make_cond('user_id', sql.EqualTo, userId),
					sql.AND,
					sql.make_cond('item_id', sql.EqualTo, itemId)	
				);
			host.con.query(query.build(), (err, result) => {
				if (!err) {
					res.send({error: null, result: {
						code: 0,
						msg: "unfavourited"
					}});
					resolve(true);
				} else {
					res.send({error: {msg: 'failed to delete data'}, result: null});
					logging("SQL_ERR/toggle-favourite: " + err.code + " " + query.build());
					resolve(false);
				}
			});
		});
	};
	var updateFavourite = function() {
		return new Promise((resolve, reject) => {
			var query = sql.make_sql(sql.UPDATE, 'cus_favourite')
				.addFields('count')
				.addValues([itemCount])
				.setCondition(
					sql.make_cond('user_id', sql.EqualTo, userId),
					sql.AND,
					sql.make_cond('item_id', sql.EqualTo, itemId)
				);
			host.con.query(query.build(), (err, result) => {
				if(!err) {
					res.send({error: null, result: {
						code: 1,
						msg: "wishlist updated"
					}});
					resolve(true);
				} else {
					res.send({error: {msg: 'failed to update data'}, result: null});
					logging("SQL_ERR/favItem-update: " + err.code + " " + query.build());
					resolve(false);
				}
			});
		});
	};

	var proccedFavourite = function() {
		return new Promise((resolve, reject) => {
			var query = sql.make_sql(sql.SELECT, 'cus_favourite')
				.addFields('id')
				.setCondition(
					sql.make_cond('user_id', sql.EqualTo, userId),
					sql.AND,
					sql.make_cond('item_id', sql.EqualTo, itemId));
			host.con.query(query.build(), (err, result) => {
				if(!err) {
					resolve(result);
				} else {
					res.send({error: {msg: 'failed to fetch data'}, result: null});
					logging("SQL_ERR/favItem-fetch: " + err.code + " " + query.build());
					reject(err);
				}
			});
		});
	};

	var proceedToggle = async () => {
		var userValid = await validateUser();
		if (userValid === false) {
			return;
		}
		if (userValid != 0) {
			var processSuccess = await proccedFavourite().catch((err) => {
				return;
			});
			if (processSuccess) {
				if(processSuccess.length != 0) {
					if(isFav == 1) {
						await updateFavourite();
					} else {
						await deleteFavourite();
					}
				} else {
					if (isFav == 1) {
						await newFavourite();
					} else {
						res.send({error: true, result: {
							code: -1,
							msg: "cannot unfavourite not existing item"
						}});
					}
				}
			}
		} else {
			res.send({error: {msg: 'user does not exist'}, result: null});
			return;
		}
	};

	proceedToggle().catch((err) => console.log(err));
});

module.exports = app;