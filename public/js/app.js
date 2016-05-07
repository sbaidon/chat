(function($) {

    var socket = io.connect('http://localhost:3000');
    var username = $("#username").text();
    var contactList = [];
    var to;
    var listEmpty = true;

    $(document).ready(function() {
        $('#fileUpload-btn').on('click', function() {
            var fileUploadControl = $("#fileUpload")[0];
            var file = fileUploadControl.files[0];
            socket.emit('file', {
                from: username,
                to: to,
                file: file,
                name: file.name
            });
        });

        $('#chat-btn').on('click', function() {
            var message = $('#chat-input').val();
            sendMessage(to, message, false);
        });

        $('#modal-accept').on('click', function() {
            var contact = $('#modal-contact').val();
            addContact(contact);
        });

        $('#btn-logout').on('click', function() {
            window.location.replace("http://localhost:3000");
            socket.emit('logout');
        });

        $('#select-presence').on('change', function() {
            socket.emit("presence", this.value);
        });

        $('#btn-createGroup').on('click', function() {
            var name = $('#modal-group').val();
            var host = "@conference.cml.chi.itesm.mx";
            var invites = getInvites();
            var group = name + host;

            $(".tab").unbind("click");
            addToContactList(name);
            activateContactList();
    
            socket.emit('creategroup', {group:group, invites: invites});

        });

    });

    socket.on('subscription', function(subscriber) {
        alert("Do you want to accept" + subscriber)
        socket.emit('response', {
            contact: subscriber,
            accept: true
        });
    });

    socket.on('add-contact', function(contact) {
        location.reload();
    });

    socket.on('received', function(data) {
        receiveMessage(data.message, data.from);
    });

    socket.on('groupchat', function(message) {
        receiveMessage(message);
    });

    socket.on('roster', function(contacts) {
        
        $(".mdl-spinner").remove();
        $('#footer').removeClass("hidden");
        if (listEmpty) {
            contacts.forEach(function(contact) {
                createCheckboxes(contact);
                addToContactList(contact.name);
            });
            activateContactList();
            listEmpty = false;
        }
    });

    socket.on('state', function(data) {
        addNotification(data.state, data.from);
    });

    socket.on('saved', function(data) {
        document.getElementById("fileUpload").value = "";
        sendMessage(to, data.url, true);
    });

    socket.on('error', function(err) {
        console.log(err);
    });

    socket.on('stanza', function(stanza) {
        console.log(stanza);
    });

    function getInvites() {
        var invites = []
        $('input[class="invites"]:checked').each(function() {
            invites.push(this.value);
        });
        return invites;
    }

    function createCheckboxes(contact) {
        var checkbox = document.createElement("input");
        var label = document.createElement("label");
        label.innerText = contact.name;
        label.for = "group" + contact.name;
        checkbox.type = "checkbox";
        checkbox.id = "group" + contact.name;
        checkbox.className = "invites";
        checkbox.value = contact.name;
        $("#contact-names").append(label);
        $("#contact-names").append(checkbox);
    }

    function addNotification(state, from) {
        switch (state) {
            case "online":
            toastr.success('is ' + state , 'Contact ' + from);
            break;
            case "away":
            toastr.warning('is ' + state , 'Contact ' + from);
            break;
            case "offline":
            toastr.error('is ' + state , 'Contact ' + from)
            break;
            default:
            toastr.success(state, from);
        }
    }

    function addContact(contact) {
        socket.emit('new', contact);
    }

    function receiveMessage(message, from) {
        document.title = "New Message from " + from;
        addNotification(message, from);

        $(document.getElementById(`${from}-chat`)).append(
            `<li class="left clearfix"><span class="chat-img pull-left">
            <img src="http://bootdey.com/img/Content/user_1.jpg" alt="User Avatar"/></span>
           <div class="chat-body clearfix">
            <div class="header"><strong class="primary-font">${from}</strong>
            <small class="pull-right text-muted">
            <i class="fa fa-clock-o"></i>Just Now</small>
            </div>
             <p id="chat-text">${message}</p>
          </div>
        </li>`
        );
    }

    function sendMessage(to, message, file) {
        var text = `${message}`;

        socket.emit('sent', {
            to: to,
            message: message
        });

        if (file) {
            text = `<a href="${message}">${message}</a>`
        }

        $(document.getElementById(to + "-chat")).append(
            `<li class="right clearfix"><span class="chat-img pull-right">
            <img src="http://bootdey.com/img/Content/user_1.jpg" alt="User Avatar"/></span>
              <div class="chat-body clearfix">
                <div class="header"><strong class="primary-font">${username}</strong>
                <small class="pull-right text-muted"><i class="fa fa-clock-o"></i>A while ago</small></div>
                 <p id="chat-text">${text}</p>
              </div>
            </li>`
        );
        $('#chat-input').val("");
    }

    function addToContactList(contact) {
        var a = document.createElement("a");
        var div = document.createElement("div");
        var innerDiv = document.createElement("div");
        var ul = document.createElement("ul");
        var small = document.createElement("small");

        a.href = "#" + contact;
        a.innerText = contact;
        a.className = "mdl-tabs__tab tab";


        div.className = "mdl-tabs__panel";
        div.id = contact;

        innerDiv.className = "chat-message";

        ul.className = "chat";
        ul.id = contact + "-chat";

        small.innerText = "";

        innerDiv.appendChild(ul);
        div.appendChild(innerDiv);
        $("#panels").append(div);
        $("#tabs").append(a);
    }

    function activateContactList() {
        var previousTab = null;
        var previousPanel = null;
        $('.tab').on('click', function() {



            if (previousPanel != null) {
                $(previousPanel).toggleClass("is-active");
                $(previousTab).toggleClass("is-active");

            }

            to = this.textContent;
            var panel = document.getElementById(to);
            $(this).toggleClass("is-active");
            $(panel).toggleClass("is-active");
            previousPanel = panel;
            previousTab = this;
        });
    }

})(jQuery);