var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var bodyParser = require('body-parser');
var xmpp = require('simple-xmpp');
var Parse = require('parse/node');

var PORT = 3000;

Parse.initialize("myAppId");
Parse.serverURL = 'http://192.241.244.151:1337/parse';

var Chat = Parse.Object.extend("Chat");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.static('public'));

app.get('/', function(req, res) {
    res.render('index', {
        title: 'Home'
    });
});

app.post('/', function(req, res) {
    var username = req.body.username;
    var password = req.body.password;
    var host = req.body.host;

    xmpp.connect({
        jid: 'admin@cml.chi.itesm.mx',
        password: 'ithe2ichi7osel',
        host: 'cml.chi.itesm.mx',
        port: 5222
    });

    res.redirect('/chat/' + username);
});


app.get('/chat/:jid', function(req, res) {
    var username = req.params.jid;
    res.render('chat', {
        username: username
    });
});

io.sockets.on('connection', function(socket) {

    xmpp.on('online', function(data) {
        xmpp.getRoster();
    });

    xmpp.on('chat', function(from, message) {
        socket.emit('received', {
            'from': from,
            'message': message
        });
    });

    xmpp.on('groupchat', function(conference, from, message, stamp) {
    	socket.emit('groupchat', message);
    });

    xmpp.on('error', function(err) {
        socket.emit('error', err);
    });

    xmpp.on('stanza', function(stanza) {
        var contacts = [];
        socket.emit('stanza',stanza);
        if (stanza.attrs.id == 'roster_0') {
            stanza.children[0].children.forEach(function(element, index) {
                var roster = {
                    name: element.attrs.jid,
                    subscription: element.attrs.subscription
                };
                console.log(roster);
                contacts.push(roster);
            });
            socket.emit('roster', contacts);
        }
        else if(stanza.name == 'iq' && stanza.attrs.type == 'result' && stanza.attrs.id == 'muc_id') {
          console.log(stanza.children[0].children);
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
        xmpp.send(data.to, data.message);
    });

    socket.on('response', function(data) {
        if (data.accept) {
            xmpp.acceptSubscription(data.contact);
            socket.emit('add-contact', data.contact);
        }
    });

    socket.on('new', function(contact) {
        xmpp.subscribe(contact);
    });

    socket.on('logout', function() {
        xmpp.setPresence('offline', 'Im not here');
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
    	xmpp.join(data.group+'/mychat');
    	data.invites.forEach(function (jid){
    	    xmpp.invite(jid, data.group, "JOIN NOW");
    	  });
    });

    socket.on('invite', function(data) {
    	xmpp.invite(data.to, data.room);
    });
    
    function getGroupMembers(data) {
    	var stanza = new xmpp.Element('iq', {from: data.from, to: data.to, type: 'get', id: 'muc_id'}).c('query', { xmlns: 'http://jabber.org/protocol/disco#items'});
    	xmpp.conn.send(stanza);
    }


});

server.listen(PORT, function() {
    console.log('Starting Web app in port ' + PORT);
});