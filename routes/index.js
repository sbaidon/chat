var express = require('express');
var router = express.Router();
var xmpp = require('simple-xmpp');
var socket = require('socket.io')();

router.route('/')
   .get(function(req, res){
       res.render('index', { title : 'Home' });
   })
   .post(function(req, res){
       var username = req.body.username;
       var password = req.body.password;
       
       
       xmpp.connect({
               jid:username,
               password:password,
               host:'192.241.244.151',
               port: 5222
       });
       
       xmpp.getRoster();
       
       xmpp.on('online', function(data) {
           xmpp.setPresence('online', 'Im here');
           console.log('Connected with JID: ' + data.jid.user);
       });
       
        xmpp.on('stanza', function(stanza) { 
         if (stanza.id == 'roster_0') { 
             var rosters = []; 
             stanza.children[0].children.forEach(function(element, index) { 
             var roster = { jid: element.attrs.jid, name: element.attrs.name, subscription: element.attrs.subscription }; 
             rosters.push(roster); 
             });
           res.redirect('/chat/?jid=' + data.jid.user + '/contacts=' + rosters);
          } 
       });
      
   });

router.route('/chat/:jid/:contacts')
  .get(function (req, res) {
      var username = req.query.jid;
      var contacts = req.query.contacts;
     
      xmpp.on('chat', function(from, message) {
          socket.emit('received', {'from':from, 'message':message});
      });

      xmpp.on('error', function(err) {
          socket.emit('error', err);
          console.error(err);
      });

      xmpp.on('subscribe', function(from) {
          socket.emit('subscription', from);
      });
     
      res.render('chat', {'username': username, 'contacts':contacts});
  })
  .post(function (req, res) {
      xmpp.send(req.body.to, req.body.message);
      socket.emit('sent', message);
  });
  
  socket.
  



module.exports = router;