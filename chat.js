var fs = require('fs');

var options = {
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.crt')
};

var QB = require('quickblox');

var express = require('express');
var app = express();
var server = require('https').createServer(options, app);
var io = require('socket.io')(server);
var bodyParser = require('body-parser');
var xmpp = require('simple-xmpp');
var Parse = require('parse/node');
Parse.initialize("myAppId");
Parse.serverURL = 'http://192.241.244.151:1337/parse';
var Chat = Parse.Object.extend("Chat");
var Important = Parse.Object.extend("Important");
var PORT = 3000;
var username;


var CREDENTIALS = {
  appId: 40425,
  authKey: 'xnDkEMM7Lkc7dQe',
  authSecret: 'fNEan7pyzXwXN5V'
};
 
QB.init(CREDENTIALS.appId, CREDENTIALS.authKey, CREDENTIALS.authSecret);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.static('public'));

app.get('/', function(req, res) {
    res.render('index');
});

app.post('/', function(req, res) {
    username = req.body.username;
    var password = req.body.password;
    var host = req.body.host;

    xmpp.connect({
        jid: username,
        password: password,
        host: host,
        port: 5222,
        credentials: true
    });
    res.redirect('/chat/' + username);
});


app.get('/chat/:jid', function(req, res) {
    var username = req.params.jid;
    res.render('chat', {
        username: username
    });
});

io.on('connection', function(socket) {

    xmpp.on('online', function(data) {
        xmpp.getRoster();
    });

    xmpp.on('chat', function(from, message) {
        console.log(message);
        socket.emit('received', {
            'from': from,
            'message': message
        });
    });

    xmpp.on('groupchat', function(conference, from, message, stamp) {
        if (from != username) {
            socket.emit('groupmessage', {
                conference: conference,
                from: from,
                message: message
            });
        }
    });

    xmpp.on('error', function(err) {
        console.log(err);
        xmpp.disconnect();
    });

    xmpp.on('stanza', function(stanza) {
        var contacts = [];
        socket.emit('stanza', stanza);
        if (stanza.attrs.id == 'roster_0') {
            stanza.children[0].children.forEach(function(element, index) {
                var roster = {
                    name: element.attrs.jid,
                    subscription: element.attrs.subscription
                };
                if (roster.subscription != "none" && roster.subscription != "from") {
                    contacts.push(roster);
                }
            });
            socket.emit('roster', contacts);
        } else if (stanza.name == 'iq' && stanza.attrs.type == 'result' && stanza.attrs.id == 'muc_id') {
            console.log(stanza.children[0].children);
        } else if (stanza.name == "message" && stanza.attrs.from.indexOf("conference") > -1 && stanza.attrs.type != "groupchat") {
            xmpp.join(stanza.attrs.from + "/" + username);
            socket.emit("joingroup", {
                name: stanza.attrs.from
            });
        } else if (stanza.attrs.type === 'set') {
            if (stanza.children[0].children[0].attrs.subscription != "none" && stanza.children[0].children[0].attrs.subscription != "from") {
                socket.emit("add-contact", {
                    name: stanza.children[0].children[0].attrs.jid
                });
            }
        }
            else if (stanza.attrs.type == 'headline') {
                socket.emit("add-contact", {
                    name: stanza.children[0].children[3].children[0]
                });
            }
    });


    xmpp.on('subscribe', function(subscriber) {
        socket.emit('subscription', subscriber);
    });

    xmpp.on('buddy', function(jid, state, statusText, resource) {
        socket.emit('state', {
            from: jid,
            state: state
        });
    });

    xmpp.on('close', function() {
        socket.emit('bad', {
            err: "logout"
        });
    });

    socket.on('sent', function(data) {
        console.log(data);
        xmpp.send(data.to, data.message, data.group);
    });

    socket.on('response', function(data) {
        if (data.accept) {
            xmpp.acceptSubscription(data.contact);
        }
        socket.emit("add-contact", {
            name: data.contact
        });
    });

    socket.on('new', function(contact) {
        xmpp.subscribe(contact);
    });

    socket.on('logout', function() {
        console.log("log out");
        xmpp.disconnect();
    });

    socket.on('disconnect', function() {
        console.log("disconnected");
    })

    socket.on('file', function(data) {
        var parseFile = new Parse.File(data.name, {
            base64: data.file
        });
        var chat = new Chat();
        chat.set("to", data.to);
        chat.set("from", data.from);
        chat.set("file", parseFile);
        chat.save(null, {
            success: function(chat) {
                console.log("saved");
                var url = chat.get("file").url();
                console.log(url);
                socket.emit('saved', {
                    url: url
                });
            },
            error: function(chat, error) {
                alert('Failed to create new object, with error code: ' + error.message);
            }
        });

    });

    socket.on('important', function(data) {
        var important = new Important();
        important.set("to", data.to);
        important.set("from", data.from);
        important.set("message", data.message);
        important.save(null, {
            sucess: function(important) {
                console.log("saved");
            },
            error: function(important, error) {
                console.log("error");
            }
        });
    });

    socket.on("retrieve", function(data) {
        var messages = [];
        var query = new Parse.Query(Important);
        query.equalTo("to", data.to);
        query.equalTo("from", data.from);
        query.find({
            success: function(results) {
                for (var i = 0; i < results.length; i++) {
                    var object = results[i];
                    var from = object.get('from');
                    var message = object.get("message");
                    var date = object.get("createdAt");
                    messages.push({
                        from: from,
                        message: message,
                        date: date
                    });
                }
                socket.emit("retrieveDone",   {
                    messages: messages
                });
            },
            error: function(error) {
                alert("Error: " + error.code + " " + error.message);
            }
        });
    });

    xmpp.on('chatstate', function(from, state) {
        socket.emit('state', {
            from: from,
            state: state
        });
    });

    socket.on('presence', function(presence) {
        xmpp.setPresence(presence);
    });

    socket.on('creategroup', function(data) {
        xmpp.join(data.group + '/' + username);
        data.invites.forEach(function(jid) {
            xmpp.invite(jid, data.group, "JOIN NOW");
        });
    });

    socket.on('invite', function(data) {
        xmpp.invite(data.to, data.room);
    });

    socket.on('check', function(data) {
        xmpp.probe(data.contact.name, function(state) {
            socket.emit('status', {
                contact: data.contact.name,
                state: state
            });
        });
    });

    socket.on('retrieveFiles', function(data) {
        var files = [];
        var query = new Parse.Query(Chat);
        query.equalTo("to", data.to);
        query.equalTo("from", data.from);
        query.find({
            success: function(results) {
                for (var i = 0; i < results.length; i++) {
                    var object = results[i];
                    var from = object.get('from');
                    var url = object.get("file").url();
                    var name = object.get("file").name().split(" ");
                    var date = object.get("createdAt");
                    files.push({
                        from: from,
                        name: name[1],
                        date: date,
                        url: url
                    });
                }
                socket.emit("retrieveFilesDone",   {
                    files: files
                });
            },
            error: function(error) {
                alert("Error: " + error.code + " " + error.message);
            }
        });
    });

    socket.on('delete', function(data) {
        xmpp.unsubscribe(data.contact);
    })


});

server.listen(process.env.PORT || PORT);