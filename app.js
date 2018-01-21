var express = require("express");
var app = express();
var server = app.listen(8080, function() {
    console.log('Ready on port %d', server.address().port);
});

// "/" => "Hi there!"
app.get("/", function(req, res) {
	res.send("Hi there!");
})

app.get("/bye", function(req, res) {
	res.send("Good bye!");
})

app.get("/dog", function(req, res) {
	res.send("MEOW!");
})

app.get("/output/:title/:name/:id", function(req, res) {
	res.send(req.params.title + " " + req.params.name + " " + req.params.id);
})

app.get("/speak/:animal", function(req, res) {
	if(req.params.animal == "pig") {
		res.send("Oink");
	} else if(req.params.animal == "cow") {
		res.send("Moo");
	} else if(req.params.dog == "dog") {
		res.send("Woof woof!");
	}
})

app.get("/repeat/:words/:n", function(req, res) {
	str = "";
	for(i = 0; i < req.params.n; ++i) {
		str = str + req.params.words + " ";
	}
	res.send(str);
})

app.get("*", function(req, res) {
	res.send("ERROR BRO!");
})

app.listen(3000, function(){
	console.log("Server has started!")
});