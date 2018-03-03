var host = require("../host");
var cond = require("./conditional");
var stmtBuilder = require("./statement");
var utils = require("../utils")

const SELECT = "SELECT";
const DELETE = "DELETE";
const UPDATE = "UPDATE";
const REPLACE = "REPLACE";
const INSERT = "INSERT";

var sql = {
		operation: null,
		fields: [],
		table: null,
		values: [],
		condition: null,
		limit: null,
		order: null
	}
sql.changeOperation = function(operation) {
	this.operation = operation.toUpperCase();
	return this;
}
sql.addFields = function(fields) {
	if (typeof(fields) == "string") {
		if (fields.indexOf(",") > -1) {
			var arr = fields.split(",");
			arr.forEach((str, index) => {
				this.fields.push(str.trim());
			});
		} else {
			this.fields.push(fields);
		}
	} else if (fields instanceof Array) {
		fields.forEach((field, index) => {
			this.fields.push(field);
		});
	} else {
		throw new Error("fields has wrong type " + fields.constructor.name);
	}
	return this;
}
sql.removeFields = function(fields) {
	if (typeof(fields) == "string") {
		var index =	this.fields.indexOf(fields);
		if (index > -1) {
			this.fields.splice(index, 1);
		}
	} else if (fields instanceof Array) {
		fields.forEach((field, index) => {
			var index = this.fields.indexOf(field);
			if (index > -1) {
				this.fields.splice(index, 1);
			}
		});	
	} else {
		throw new Error("fields has wrong type " + fields.constructor.name);
	}
	return this;
}
sql.addValues = function(values) {
	if (typeof(values) == "string") {
		this.values.push(values);
	} else if (values instanceof Array) {
		values.forEach((value, index) => {
			this.values.push(value);
		});
	} else {
		throw new Error("values has wrong type " + values.constructor.name);
	}
	return this;
}
sql.removeValues = function(values) {
	if (typeof(values) == "string") {
		this.values.push(values);
	} else if (values instanceof Array) {
		values.forEach((value, index) => {
			this.values.push(value);
		});
	} else {
		throw new Error("values has wrong type " + values.constructor.name);
	}
	return this;
}
sql.setCondition = function(left, operator, right) {
	if (typeof(left) == "object") {
		this.condition = left;
	} else {
		this.condition = cond.make_cond(left, operator, right);
	}
	return this;
}
sql.addCondition = function(operator, right) {
	if (this.condition == null) {
		this.condition = right;
	} else {
		this.condition = cond.make_cond(this.condition, operator, right);
	}
	return this;
}
sql.setLimit = function(offset, length) {
	if (length == null) {
		this.limit = {offset: null, length: offset};
	} else {
		this.limit = {offset: offset, length: length};
	}
	return this;
}
sql.setOrder = function(field, type) {
	this.order = {by: field, type: type};
	return this;
}
sql.build = function() {
	var stmt = stmtBuilder.make_stmt(this);
	if (this.operation == "SELECT") {
		stmt.select();
	} else if (this.operation == "UPDATE") {
		stmt.update();
	} else if (this.operation == "DELETE") {
		stmt.delete();
	} else if (this.operation == "INSERT") {
		stmt.insert();
	} else if (this.operation == "REPLACE") {
		stmt.replace();
	}
	return stmt.statement;
}

var createSQL = function(operation, table) {
	var newSQL = utils.clone(sql);

	newSQL.operation = operation.toUpperCase();
	newSQL.table = table;

	return newSQL;
}

module.exports = {
	make_sql: createSQL,
	make_cond: cond.make_cond,
	SELECT: SELECT,
	UPDATE:UPDATE,
	DELETE: DELETE,
	REPLACE: REPLACE,
	INSERT: INSERT,
	AND: cond.AND,
	OR: cond.OR,
	ASC: cond.ASC,
	DESC: cond.DESC,
	EqualTo: cond.EqualTo,
	Greater: cond.Greater,
	GreaterOrEqual: cond.GreaterOrEqual,
	Less: cond.Less,
	LessOrEqual: cond.LessOrEqual,
	LIKE: cond.LIKE,
	BETWEEN: cond.BETWEEN
}