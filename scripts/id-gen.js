var TRANSACTION_ID = 0;
var TOKO_IMAGE_ID = 0;
var ITEM_IMAGE_ID = 0;

var setTransactionId = function(id) {
	TRANSACTION_ID = id;
}
var setTokoImageId = function(id) {
	TOKO_IMAGE_ID = id;
}
var setItemImageId = function(id) {
	ITEM_IMAGE_ID = id;
}

var getTransactionId = function() {
	TRANSACTION_ID = TRANSACTION_ID + 1;
	return TRANSACTION_ID;
}
var getTokoImageId = function() {
	TOKO_IMAGE_ID = TOKO_IMAGE_ID + 1;
	return TOKO_IMAGE_ID;
}
var getItemImageId = function() {
	ITEM_IMAGE_ID = ITEM_IMAGE_ID + 1;
	return ITEM_IMAGE_ID;
}

module.exports = {
	setTransactionId: setTransactionId,
	setTokoImageId: setTokoImageId,
	setItemImageId: setItemImageId,
	getTransactionId: getTransactionId,
	getTokoImageId: getTokoImageId,
	getItemImageId: getItemImageId
}