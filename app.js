var express = require("express");
var fs = require("fs");
var app = express();

const MYSQL_HOST = 0;
const MYSQL_USER = 1;
const MYSQL_PASS = 2;
const MYSQL_PORT = 3;

var host = fs.readFileSync('host.dat', 'utf8').split(",");
if(host[MYSQL_PASS] == 0) {
	host[MYSQL_PASS] = "";
}
if(host[MYSQL_PORT] == 0) {
	host[MYSQL_PORT] = null;
}
var mysql = require("mysql");
var con = mysql.createConnection({
	host: host[MYSQL_HOST],
	user: host[MYSQL_USER],
	password: host[MYSQL_PASS],
	port: host[MYSQL_PORT]
});
var connect_msg = "Error!"
con.connect(function(err) {
	if(!err) {
		connect_msg = "Connected!";
	}
});
app.get("/", (req, res) => {
	res.send(connect_msg);
});
app.listen(3000, () => {
	console.log("Server On!");
});

/*
app.use(express.static("public"));

app.get("/fallinlovewith/:thing", (req, res) => {
	var thing = req.params.thing;
	res.render("love.ejs", {thing: thing});
})

app.get("/post", (req, res) => {
	var posts = [
		{title: "Post 1", author: "A"},
		{title: "Post 2", author: "B"},
		{title: "Post 3", author: "C"}
	]
	res.render("post.ejs", {posts: posts});
})

// "/" => "Hi there!"
app.get("/hi", function(req, res) {
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
*/