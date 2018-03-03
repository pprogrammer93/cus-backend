var fs = require("fs");

String.prototype.slicedReplace = function(replaced, replacing, index) {
  if (index == null) {
    index = 0;
  }
  left = this.slice(0, index);
  right = this.slice(index, this.length);
  return left + right.replace(replaced, replacing);
}

var logging = function(message) {
	fs.appendFile('log.dat', message+"\n", function (err) {
	  if (err) throw err;
	});
}

var parseExtension = function(file) {
  var s = "";
  i = file.length - 1;
  while (i >= 0 && file[i] != '.') {
    s = file[i] + s;
    i--;
  }

  if (i >= 0) {
    return s;
  } else {
    return "";
  }
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

var seperateScheme = function(scheme) {
  separatorType = ['/', ':', '.', '_', '*', '+', '(',')','-'];

  if (separatorType.indexOf(scheme[0]) == -1) {
    mode = 0;
  } else {
    mode = 1;
  }

  keyCollection = [];
  separatorCollection = [];

  key = '';
  separator = '';
  index = 0;
  do {
    if (mode == 0) {
      if (separatorType.indexOf(scheme[index]) != -1) {
        keyCollection.push(key);
        key = '';
        mode = 1;
        separator += scheme[index];
      } else {
        key += scheme[index];
      }
    } else {
      if (separatorType.indexOf(scheme[index]) == -1) {
        separatorCollection.push(separator);
        separator = '';
        mode = 0;
        key += scheme[index];
      } else {
        separator += scheme[index];
      }
    }
    if ((index + 1) == scheme.length) {
      if (mode == 0) {
        keyCollection.push(key);
      } else {
        keyCollection.push(separator);
      }
    } 
    index += 1;
  } while (index < scheme.length);

  return {keys: keyCollection, separators: separatorCollection};
}

var parseScheme = function(scheme, url) {
  pScheme = seperateScheme(scheme);
  keyCollection = pScheme.keys;
  separatorCollection = pScheme.separators;

  value = '';
  key_index = 0;
  index = 0;
  counter = 0;
  parsedUrl = {};
  do {
    if (key_index < separatorCollection.length) {
      while (counter < separatorCollection[key_index].length && separatorCollection[key_index][counter] == url[index + counter]) {
        counter++;
      }
      if (counter == separatorCollection[key_index].length) {
        parsedUrl[keyCollection[key_index]] = value;
        key_index++;
        index += counter-1;
        value = '';
        counter = 0; 
      } else {
        value += url[index];
      }
    } else {
      if ((index + 1) == url.length) {
        parsedUrl[keyCollection[key_index]] = value + url[index];
      } else {
        value += url[index];
      }
    }
    index++;
  } while (index < url.length);

  return parsedUrl;
}

var buildScheme = function(scheme, values) {
  pScheme = seperateScheme(scheme);
  keys = pScheme.keys;
  temp = 0;
  replacePos = 0;

  values.forEach((value, index) => {
    if (value == undefined) {
      throw new TypeError("value undefined found for scheme " + scheme);
    }
    temp = scheme.indexOf(keys[index]) + value.length;
    scheme = scheme.slicedReplace(keys[index], value, replacePos);
    replacePos = temp;
  });
  return scheme;
}

var nullException = function(arr, development = false) {
  i = 0;
  nullFound = false;
  while (i < arr.length && !nullFound) {
    if (arr[i] == null || arr[i] === undefined) {
      if (development) {
        console.log("null at index: " + i);
      }
      nullFound = true;
    }
    i++;
  }
  return nullFound;
}

module.exports = {
  logging: logging,
  clone: clone,
  parse_scheme: parseScheme,
  build_scheme: buildScheme,
  null_check: nullException,
  parse_extension: parseExtension
}