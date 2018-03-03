var TRANSACTION_ID = 0;

var setTransactionId = function(id) {
	TRANSACTION_ID = id;
}

var getTransactionId = function() {
	TRANSACTION_ID = TRANSACTION_ID + 1;
	return TRANSACTION_ID;
}

module.exports = {
	setTransactionId: setTransactionId,
	getTransactionId: getTransactionId,
}