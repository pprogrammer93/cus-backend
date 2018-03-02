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
}
sql.addFields = function(fields) {
	if (typeof(fields) == "string") {
		this.fields.push(fields);
	} else if (fields instanceof Array) {
		fields.forEach((field, index) => {
			this.fields.push(field);
		});
	} else {
		throw new Error("fields has wrong type " + fields.constructor.name);
	}
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
}
sql.setCondition = function(left, operator, right) {
	if (typeof(left) == "object") {
		this.condition = left;
	} else {
		this.condition = cond.make_cond(left, operator, right);
	}
}
sql.setLimit = function(offset, length) {
	this.limit = {offset: offset, length: length};
}
sql.setOrder = function(field, type) {
	this.order = {by: field, type: type};
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
	LIKE: cond.LIKE
}