var utils = require('../utils')

const AND = "AND";
const OR = "OR";
const ASC = "ASC";
const DESC = "DESC";
const EqualTo = "=";
const Greater = ">";
const GreaterOrEqual = ">=";
const Less = "<";
const LessOrEqual = "<=";
const LIKE = "LIKE";
const BETWEEN = 'BETWEEN';

var condition = {
	left_operator: null,
	operator: null,
	right_operator: null
}
condition.toString = function() {
	var left = "";
	var right = "";
	if (typeof(this.left_operator) == "object") {
		left = "(" + this.left_operator.toString()  + ")";
	} else {
		left = this.left_operator;
	}
	if (typeof(this.right_operator) == "object") {
		right = "(" + this.right_operator.toString() + ")";
	} else {
		right = this.right_operator;
	}

	return left + " " + this.operator + " " + right;
}

createCondition = function(left, operator, right, extension = null) {
	var newCondition = utils.clone(condition);

	if (extension != null) {
		right += ' AND ' + extension;
	} else {
		if (typeof(right) == "string") {
			right = "'" + right + "'";
		}
	}

	newCondition.left_operator = left;
	newCondition.operator = operator;
	newCondition.right_operator = right;

	return newCondition;
}

module.exports = {
	make_cond: createCondition,
	AND: AND,
	OR: OR,
	ASC: ASC,
	DESC: DESC,
	EqualTo: EqualTo,
	Greater: Greater,
	GreaterOrEqual: GreaterOrEqual,
	Less: Less,
	LessOrEqual: LessOrEqual,
	LIKE: LIKE,
	BETWEEN: BETWEEN
}