var fs = require('fs');

var options = {
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.crt')
};

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
var PORT = 3000;
var username;

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
        host: 'cml.chi.itesm.mx',
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
        socket.emit('error', {
            err: err
        });
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
        	if(stanza.children[0].children[0].attrs.subscription != "none" &&  stanza.children[0].children[0].attrs.subscription != "from") {
            socket.emit("add-contact", {
                name: stanza.children[0].children[0].attrs.jid
            });
        	}
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
        console.log('connection has been closed!');
    });

    socket.on('sent', function(data) {
        xmpp.send(data.to, data.message, data.group);
    });

    socket.on('response', function(data) {
        if (data.accept) {
            xmpp.acceptSubscription(data.contact);
            socket.emit('add-contact', {
                name: data.contact
            });
        }
    });

    socket.on('new', function(contact) {
        xmpp.subscribe(contact);
    });

    socket.on('logout', function() {
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

    socket.on('delete', function(data) {
        xmpp.unsubscribe(data.contact);
    })


});

server.listen(process.env.PORT || PORT);