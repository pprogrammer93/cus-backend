var fs = require("fs");

var logging = function(message) {
	fs.appendFile('log.dat', message+"\n", function (err) {
	  if (err) throw err;
	});
}

var clone = function(obj) {
  if (obj === null || typeof(obj) !== 'object' || 'isActiveClone' in obj)
    return obj;

  if (obj instanceof Date)
    var temp = new obj.constructor(); //or new Date(obj);
  else
    var temp = obj.constructor();

  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      obj['isActiveClone'] = null;
      temp[key] = clone(obj[key]);
      delete obj['isActiveClone'];
    }
  }

  return temp;
}

module.exports = {
	logging: logging,
	clone: clone
}