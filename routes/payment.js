var express = require('express');
var host = require('../scripts/host');
var utils = require('../scripts/utils');
var idGen = require('../scripts/id-gen');
var sql = require('../scripts/sql-builder/sql-builder');
var app = express.Router();
var logging = utils.logging;

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

function eliminateExpiredTransaction(transactionId, trasactionEstimation) {
	est_json = dateToJSON(trasactionEstimation);
	estimated = new Date(est_json.year, est_json.month, est_json.day, est_json.hour, est_json.minute, 0, 0);
	estimated = new Date(estimated.getTime() + 1800000);

	if (estimated <= (new Date)) {
		var query = sql.make_sql(sql.UPDATE, 'cus_transaction').addFields('status').addValues([3]).setCondition('transaction_id', sql.EqualTo, transactionId);
		host.con.query(query.build(), (err, result) => {
			if (err) {
				logging("SQL_ERR/payment/expireTransaction: " + err.code + " " + query.build());
			}
		});
	}
}

async function getHistory(query, finish){
	var expQuery = utils.clone(query);
	var expQuery = expQuery.addCondition(sql.AND, sql.make_cond('status', sql.EqualTo, 0));
	var expiration = await new Promise((resolve, reject) => {
		host.con.query(expQuery.build(), (err, result) => {
			if(err) {
				logging("SQL_ERR/payment: " + err.code + " " + expQuery.build());
				reject(true);
			} else {
				result.forEach((transaction, index) => {
					eliminateExpiredTransaction(transaction.transaction_id, transaction.estimation);
				});
				resolve(true);
			}
		});
	}).catch((err) => console.log(err));

	var historyList = [];
	var getTransaction = await new Promise(resolve => {
		host.con.query(query.build(), (err, result) => {
			if(err) {
				res.send({error: {msg: 'failed to retrieve data'}, result: null});
				logging("SQL_ERR/payment/history/"+userId+": " + err.code + " " + query.build());
				reject(true);
			} else if (result.length == 0) {
				resolve([]);
			} else {
				var itemPromises = [];
				var tokoPromises = [];

				result.forEach((transaction, index) => {
					var date = dateToJSON(transaction.estimation);
					console.log(JSON.stringify(transaction));
					console.log(transaction.comment);
					var history = 
					{
						transaction_id: transaction.transaction_id,
						created_at: transaction.created_at, 
						status: transaction.status, 
						estimation: date.hour + ":" + date.minute,
						rating: transaction.rating,
						total_price: transaction.total_price,
						comment: transaction.comment
					}

					var itemQuery = sql.make_sql(sql.SELECT, 'cus_purchase')
						.addFields('item_id, item_name, item_quantity, price_total')
						.setCondition('transaction_id', sql.EqualTo, transaction.transaction_id);
					var itemPromise = new Promise((resolve, reject) => {
						host.con.query(itemQuery.build(), (err, result) => {
							if (err) {
								reject(err.code + " " + itemQuery.build());
							} else {
								history.list_items = JSON.parse(JSON.stringify(result));
								resolve(true);
							}
						});
					}).catch((err) => console.log(err));
					itemPromises.push(itemPromise);

					var tokoQuery = sql.make_sql(sql.SELECT, 'cus_toko')
						.addFields('name, address, phone, latitude, longitude')
						.setCondition('toko_id', sql.EqualTo, transaction.toko_id);
					var tokoPromise = new Promise((resolve, reject) => {
						host.con.query(tokoQuery.build(), (err, result) => {
							if (err) {
								reject(err.code + " " + tokoQuery.build());
							} else {
								history.toko = JSON.parse(JSON.stringify(result));
								resolve(history);
							}
						});
					}).catch((err) => console.log(err));
					tokoPromises.push(tokoPromise);
				});
				Promise.all(itemPromises).then(function(values) {
					Promise.all(tokoPromises).then(function(values) {
						values.forEach((value, index) => {
							historyList.push(value);
							resolve(true);
						});
					}).catch((err) => {
						res.send({error: {msg: 'failed to retrieve data'}, result: null});
						logging("SQL_ERR/payment/history/"+userId+": " + err);
					});
				}).catch((err) => {
					res.send({error: {msg: 'failed to retrieve data'}, result: null});
					logging("SQL_ERR/payment/history/"+userId+": " + err);
				});
			}
		});
	}).catch((err) => console.log(err));

	if (getTransaction) {
		finish(historyList);
	} else {
		return null;
	}
};

app.get("/:transaction_id", (req, res) => {
	req.session.authorized = true;
	res.render("review.ejs", {id: req.params.transaction_id, domain: host.DOMAIN, dir: host.DIR});
});

app.post('/get/:transaction_id', (req, res) => {
	var transactionId = req.params.transaction_id;
	var loadTransaction = async () => {
		var query = sql.make_sql(sql.SELECT, 'cus_transaction').addFields('*').setCondition('transaction_id', sql.EqualTo, transactionId);
		var transaction = await new Promise((resolve, reject) => {
			host.con.query(query.build(), (err, result) => {
				if(err) {
					res.send({error: {msg: 'failed to retrieve '}, result: null});
					logging("SQL_ERR/payment/"+transactionId+": " + err.code + " " + query.build());
					reject(null);
				} else {
					resolve(result[0]);
				}
			});
		});
		if (transaction != null) {
			var query = sql.make_sql(sql.SELECT, 'cus_purchase').addFields('*').setCondition('transaction_id', sql.EqualTo, transactionId);
			host.con.query(query.build(), (err, result) => {
				if(err ) {
					res.send({error: {msg: 'failed to retrieve data'}, result: null});
					logging("SQL_ERR/payment/"+transaction_id+": " + err.code + " " + query.build());
				} else {
					var response = 
					{
						user_id: transaction.user_id,
						toko_id: transaction.toko_id,
						created_at: transaction.created_at,
						status: transaction.status,
						estimation: transaction.estimation,
						rating: transaction.rating,
						comment: transaction.comment,
						item_list: []
					};
					result.forEach((item, index) => {
						response.item_list.push(item);
					});
					res.send({error: null, result: response});
				}
			});
		}
	};
	loadTransaction().catch((err) => console.log(err));
});

app.post("/:transaction_id/confirm", (req, res) => {
	var transactionId = req.params.transaction_id;
	var query = sql.make_sql(sql.UPDATE, 'cus_transaction').addFields('status').addValues([1]).setCondition('transaction_id', sql.EqualTo, transactionId);
	host.con.query(query.build(), (err, result) => {
		if(err) {
			res.send({error: {msg: 'failed to change data'}, result: null});
			logging("SQL_ERR/payment/"+transaction_id+"/confirm: " + err.code + " " + query.build());
		} else {
			res.send({error: null, result: null});
		}
	});
}); 

app.post("/:transaction_id/delete", (req = null, res = null) => {
	var transaction_id = req.params.transaction_id;
	var query = sql.make_sql(sql.DELETE, 'cus_transaction').setCondition('transaction_id', sql.EqualTo, transaction_id);
	host.con.query(query.build(),(err, result) => {
		if(err) {
			res.send({error: {msg: 'failed to delete transaction'}, result: null});
			logging("SQL_ERR/payment/"+transaction_id+"/delete: " + err.code + " " + query.build());
		} else {
			res.redirect("http://" + host.DOMAIN);
		}
	});
});

app.post("/:transaction_id/rate", (req, res) => {
	if(!(req.body.rating)) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}
	var rating = req.body.rating;
	var comment = req.body.comment;

	var transaction_id = req.params.transaction_id;
	var query = sql.make_sql(sql.UPDATE, 'cus_transaction')
		.addFields('status, rating, comment')
		.addValues([2, rating, comment])
		.setCondition('transaction_id', sql.EqualTo, transaction_id);
	host.con.query(query.build(), (err, result) => {
		if(!err) {
			res.send({error: null, result: null});
		} else {
			res.send({error: {msg: 'failed to give rating'}, result: null});
			logging("SQL_ERR/payment/"+transaction_id+"/delete: " + err.code + " " + query.build());
		}
	});
});

app.post("/purchase", (req, res) => {
	if(utils.null_check([req.body.user_id, req.body.estimation_hour, req.body.estimation_minute, req.body.item_list])) {
		res.send({error: {msg: 'lack of parameter'}, result: null});
		return;
	}
	var userId = req.body.user_id;
	var tokoId = req.body.item_list[0].toko_id;
	var estimation_hour = req.body.estimation_hour;
	var estimation_minute = req.body.estimation_minute;
	var itemList = req.body.item_list;

	var transactionId = idGen.getTransactionId();
	var time = new Date();
	var createdAt = time.getDate() + "-" + (time.getMonth() + 1) + "-" + time.getFullYear() + "-" + time.getHours() + ":" + time.getMinutes(); 
	var estimation = formatTime(estimation_hour, estimation_minute);
	var pendingPurchase = [];
	
	var itemPromises = [];
	itemList.forEach((item, index) => {
		if(utils.null_check([item.toko_id, item.item_id, item.item_quantity, item.total_price, item.name])) {
			item.msg = "lack of data";
			pendingPurchase.push(item);
		} else {
			var query = sql.make_sql(sql.INSERT, 'cus_purchase')
				.addFields('transaction_id, item_id, item_name, item_quantity, price_total')
				.addValues([transactionId, item.item_id, item.name, item.item_quantity, item.total_price]);
			var promise = new Promise((resolve, reject) => {
				host.con.query(query.build(), (err, result) => {
					if(err) {
						logging("SQL_ERR/payment/purchase: " + err.code + " " + query.build());
						item.msg = "failed to store data";
						pendingPurchase.push(item);
						resolve(-1);
					}
					resolve(item.total_price);
				});
			});
			itemPromises.push(promise);
		}
	});

	Promise.all(itemPromises).then(function(values) {
		if(pendingPurchase.length != 0) {
			logging("SQL_ERR/payment/purchase: " + pendingPurchase);
			res.send({error: {msg: "some purchase failed"}, result: pendingPurchase});
			return;
		} 
		var totalPrice = 0;
		values.forEach((price, index) => {
			if (price == -1) {
				logging("SQL_ERR/payment/purchase: negative price exist");
				res.send({error: {msg: "failed to store transaction data"}, result: null});
				return;
			} else {
				totalPrice += price;
			}
		});
		var query = sql.make_sql(sql.INSERT, 'cus_transaction')
				.addFields('transaction_id, user_id, toko_id, total_price, created_at, estimation')
				.addValues([transactionId, userId, tokoId, totalPrice, createdAt, estimation]);
		host.con.query(query.build(), (err, result) => {
			if(err) {
				logging("SQL_ERR/payment/purchase: " + err.code + " " + query.build());
				res.send({error: {msg: "failed to store transaction data"}, result: null});
			} else {
				res.send({error: null, result: {transaction_id: transactionId}});
			}
		});
	}).catch((err) => console.log(err));

	
});

app.post("/history", (req, res) => {
	var offset = req.body.offset;
	var limit = req.body.limit;
	var status = req.body.status;
	var search = req.body.search;
	var userId = req.body.user_id;

	var query = sql.make_sql(sql.SELECT, 'cus_transaction').setOrder('transaction_id', sql.DESC);
	if (userId != null) {
		query.setCondition('user_id', sql.EqualTo, userId);
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
	if (status != null) {
		if (status == 'completed') {
			query.addCondition(sql.AND, sql.make_cond('status', sql.EqualTo, 1));
		} else if (status == 'waiting') {
			query.addCondition(sql.AND, sql.make_cond('status', sql.EqualTo, 0));
		}
	}
	if (search != null && search.length != 0) {
		query.addCondition(sql.AND, sql.make_cond('transaction_id', sql.LIKE, '%'+search+'%'));
	} 

	getHistory(query, (data) => res.send({error: null, result: data})).catch((err) => {
		res.send({error: {msg: "failed to retrieve data"}, result: null});
		console.log(err);
	});
	
});

module.exports = app;

