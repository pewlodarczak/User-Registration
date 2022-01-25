const express = require('express'),
	app = express(),
	mongoose = require("mongoose"),
	passport = require("passport"),
	bodyParser = require("body-parser"),
	LocalStrategy = require("passport-local"),
	passportLocalMongoose = require("passport-local-mongoose"),
	User = require("./models/user");
imgModel = require("./models/images");
const WebSocket = require('ws');

const socketServer = new WebSocket.Server({port: 3030});

require('dotenv/config');

var fs = require('fs');
var path = require('path');

var loggedinUser;

/*
	TODO #1 List buttons
		 #2 Change password
		 #3 Nav Menu
*/

//Connecting database
mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true }, err => {
	console.log(`Connected to ${process.env.MONGO_URL}`)
	mongoose.use
});

app.use(require("express-session")({
	secret: "password",       //decode or encode session
	resave: false,
	saveUninitialized: false
}));

passport.serializeUser(User.serializeUser());       //session encoding
passport.deserializeUser(User.deserializeUser());   //session decoding
passport.use(new LocalStrategy(User.authenticate()));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded(
	{ extended: true }
))

app.use(bodyParser.urlencoded({ extended: false }))
//app.use(bodyParser.json())

app.use(passport.initialize());
app.use(passport.session());

//const { populate } = require('./models/user');

// Schritt 5 - Set up multer um upload files zu speichern
var multer = require('multer');

var storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, 'uploads')
	},
	filename: (req, file, cb) => {
		cb(null, file.fieldname + '-' + Date.now())
	}
});

var upload = multer({ storage: storage });

//=======================
//      R O U T E S
//=======================
app.get("/", (req, res) => {
	res.render("home");
})

app.get("/welcomeuser", isLoggedIn, async (req, res) => {
	if (req.user) {
		let user = await User.findOne({ username: req.user.username });
		loggedinUser = user.username;
		res.render('welcomeuser', { loggedinUser });
	} else {
		res.render('welcomeuser2');
	}
})

app.get("/loginfailure", (req, res) => {
	console.log("Login Failure")
	res.render('loginfailure');
})

app.get('/uploadImages', isLoggedIn, (req, res) => {
	imgModel.find({}, (err, items) => {
		if (err) {
			console.log(err);
			res.status(500).send('An error occurred', err);
		}
		else {
			res.render('uploadImages', { items: items });
		}
	});
});

app.post('/', upload.single('image'), (req, res, next) => {
	var obj = {
		name: req.body.name,
		desc: req.body.desc,
		userid: loggedinUser,
		numLikes: '0',
		img: {
			data: fs.readFileSync(path.join(__dirname + '/uploads/' + req.file.filename)),
			contentType: 'image/png'
		}
	}
	imgModel.create(obj, (err, item) => {
		if (err) {
			console.log(err);
		}
		else {
			// item.save();
			//res.redirect('/');
			res.redirect('uploadImages');
		}
	});
});

app.get('/userimages', isLoggedIn, (req, res) => {
	imgModel.find({ 'userid': loggedinUser }, (err, items) => {
		if (err) {
			console.log(err);
			res.status(500).send('An error occurred', err);
		}
		else {
			res.render('displayImgnew', { items: items });
		}
	});
});

app.get("/delete/*", (req, res) => {
	const { id, name } = req.query;
	imgModel.deleteOne({ name: name }, function (err) {
		if (err) {
			res.redirect("/userimages")
		} else {
			res.redirect("/userimages")
		}
	});
});

app.get('/userprofile', async (req, res) => {
	let user = await User.findOne({ username: req.user.username });
	User.find({}, (err, items) => {
		if (err) {
			console.log(err);
			res.status(500).send('An error occurred', err);
		}
		else {
			res.render('userprofile', { user });
		}
	});
});

app.get('/clicked/*', async (req, res) => {
	const { id, name } = req.query;
	let img = await imgModel.findOne({ name: name });
	let likes = img.numLikes;
	imgModel.findOneAndUpdate({ name: name }, { numLikes: ++likes }, function (err, doc) {
		if (err) {
			return res.send(500, { error: err });
		} else {
			console.log(likes);
			res.redirect("/userimages")
		}
	});
});

app.get("/data", (req, res) => {
	database.getMostRecentEntry()
		.then(data => res.json(data))
		.catch(err => res.status(500).end());
});


const messages = ['Start Chatting!'];

socketServer.on('connection', (socketClient) => {
	console.log('connected');
	console.log('Number of clients: ', socketServer.clients.size);
	socketClient.send(JSON.stringify(messages));
	socketClient.on('message', (message) => {

		console.log('message 1 ' + message);
	  	messages.push(message);

	  	socketServer.clients.forEach((client) => {
		if (client.readyState === WebSocket.OPEN) {
			console.log('message 2 ' + message);
		  	client.send(JSON.stringify([message]));
		  	//client.send([message]);
		}
	  });
	});

	socketClient.on('close', (socketClient) => {
		console.log('closed');
		console.log('Number of clients: ', socketServer.clients.size);
	});
  });

//Auth Routes
app.get("/login", (req, res) => {
	res.render("login");
});

app.post("/login", passport.authenticate("local", {
	successRedirect: "/welcomeuser",
	failureRedirect: "/loginfailure"
	//failureRedirect: "/welcomeuser"
}), function (req, res) {

});

app.get("/register", (req, res) => {
	res.render("register");
});

app.post("/register", (req, res) => {

	User.register(new User({ username: req.body.username, phone: req.body.phone, telephone: req.body.telephone }), req.body.password, function (err, user) {
		if (err) {
			console.log(err);
			res.render("register");
		}
		passport.authenticate("local")(req, res, function () {
			res.redirect("/login");
		})
	})
})

app.get("/logout", (req, res) => {
	req.logout();
	res.redirect("/");
});

function isLoggedIn(req, res, next) {
	if (req.isAuthenticated()) {
		return next();
	}
	res.redirect("/login");
}

app.get("/chatwindow", async (req, res) => {
		if (req.user) {
			let user = await User.findOne({ username: req.user.username });
			loggedinUser = user.username;
			res.render('chatwindow', { loggedinUser });
			//res.sendFile(path.join(__dirname, '/views/chatwindow.html'))
		} else {
			res.render('welcomeuser2');
		}
	})

//var deleteRouter = require('./delete-route');
//app.use('/', deleteRouter);

app.use(express.static(__dirname));

//Listen On Server
app.listen(process.env.PORT || 3000, function (err) {
	if (err) {
		console.log(err);
	} else {
		console.log(`Server Started At Port ${process.env.PORT}`);
	}
});