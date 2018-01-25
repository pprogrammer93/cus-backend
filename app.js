var express = require("express");
var fs = require("fs");
var hash = require("password-hash");
var app = express();
var bodyParser = require("body-parser");

const HOST_HOST = 0;
const HOST_USER = 1;
const HOST_PASS = 2;
const HOST_PORT = 3;
const HOST_DB = 4;
const HOST_DOMAIN = 5;
const HOST_KEY = 6;

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({
	extended: true
}));

var host = fs.readFileSync('host.dat', 'utf8').split(",");
if(host[HOST_PASS] == 0) {
	host[HOST_PASS] = "";
}
if(host[HOST_PORT] == 0) {
	host[HOST_PORT] = null;
}
var mysql = require("mysql");
var con = mysql.createConnection({
	host: host[HOST_HOST],
	user: host[HOST_USER],
	password: host[HOST_PASS],
	port: host[HOST_PORT],
	database: host[HOST_DB]
});
var connect_msg = ""
con.connect(function(err) {
	if(!err) {
		connect_msg = "Hi there!";
	} else {
		connect_msg = "Opps! " + err.code;
	}
});
app.get("/", (req, res) => {
	res.send(connect_msg);
});
app.listen(3000, () => {
	console.log("Server On!");
});

app.get("/register", (req, res) => {
	res.render("register.ejs", {domain: host[HOST_DOMAIN]});
});

app.post("/create-account", (req, res) => {
	if(req.headers.authorization == host[HOST_KEY]) {
		if(req.body.name && req.body.email && req.body.phone && req.body.password_1 && req.body.password_2) {
			var select = "SELECT email FROM cus_user WHERE email=" + "'" + req.body.email + "'";

			con.query(select, (err, result) => {
				if(result.length == 0) {
					if(req.body.password_1 == req.body.password_2) {
						var passHash = hash.generate(req.body.password_1, {'algorithm': 'sha1', 'saltLength': 8, 'iterations': 1});
						var name = "'" + req.body.name + "'";
						var email = "'" + req.body.email + "'";
						var phone = "'" + req.body.phone + "'";
						var password = "'" + passHash + "'";
						var sql = "INSERT INTO cus_user (name, email, phone, password) VALUES (" + name + "," + email + "," + phone + "," + password + ")";
						
						con.query(sql, (err, result) => {
							if(!err) {
								sql = "SELECT id FROM cus_user WHERE email=" + "'" + req.body.email + "'";

								con.query(sql, (err, result) => {
									if(!err) {
										res.send(
											{
												error: {}, 
												result: {
													id: result[0].id, 
													name: req.body.name, 
													email: req.body.email, 
													phone: req.body.phone
												}
											});
									} else {

									}
								});
								
							} else {
								res.send({error: {msg: 'failed to store data'}, result: {}});
							}
						});
					} else {
						res.send({error: {msg: 'password mismatch'}, result: {}});
					}
				} else {
					res.send({error: {msg: 'failed: email has been exist'}, result: {}});
				}
			});
		} else {
			res.send({error: {msg: 'lack of parameter'}, result: {}});
		}
	} else {
		res.send({error: {msg: 'unauthorized'}, result: {}});
	}
});

app.post("/verify", (req, res) => {
	if(req.headers.authorization == host[HOST_KEY]) {
		if(req.body.email && req.body.password) {
			var sql = "SELECT id, name, phone, password FROM cus_user WHERE email=" + "'" + req.body.email + "'";

			con.query(sql, (err, result) => {
				if(!err) {
					if(result.length != 0) {
						if(hash.verify(req.body.password, result[0].password)) {
							res.send(
								{
									error: {}, 
									result: {
										id: result[0].id, 
										name: result[0].name, 
										email: req.body.email, 
										phone: result[0].phone
									}
								});
						} else {
							res.send({error: {msg: 'wrong password'}, result: {}});
						}
					} else {
						res.send({error: {msg: 'user does not exist'}, result: {}});
					}
				} else {
					res.send({error: {msg: 'failed to verify data'}, result: {}});
				}
			});
		} else {
			res.send({error: {msg: 'lack of parameter'}, result: {}});
		}
	} else {
		res.send({error: {msg: 'unauthorized'}, result: {}});
	}
})

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