(function($) {

    var socket = io.connect();
    var username = $("#username").text();
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
            if (to.indexOf("conference") > -1) {
                console.log("group message");
                sendMessage(to, message, false, true);
            } else {
                console.log("normal message");
                sendMessage(to, message, false, false);
            }
        });

        $('#modal-add').on('click', function() {
            var contact = $('#modal-contact').val();
            addContact(contact);
        });

        $('#modal-delete').on('click', function() {
            var contact= $('#modal-delete-contact').val();
            deleteContact(contact);
        });

        $('#btn-logout').on('click', function() {
            window.location.replace("https://localhost:3000");
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

            var contact = {
                name: group
            };

            cleanContactList(contact);
            socket.emit('creategroup', {
                group: group,
                invites: invites
            });

        });

    });

    socket.on('joingroup', function (group) {
        cleanContactList(group);
    });

    socket.on('subscription', function(subscriber) {
        alert("Do you want to accept" + subscriber)
        socket.emit('response', {
            contact: subscriber,
            accept: true
        });
    });

    socket.on('add-contact', function(contact) {
        cleanContactList(contact);
        createCheckboxes(contact);
    });

    socket.on('received', function(data) {
        receiveMessage(data.message, data.from);
    });

    socket.on('groupmessage', function(data) {
        receiveGroupMessage(data.conference, data.from, data.message);
    });

    socket.on('roster', function(contacts) {
        $(".mdl-spinner").remove();
        $('#footer').removeClass("hidden");
        if (listEmpty) {
            contacts.forEach(function(contact) {
                createCheckboxes(contact);
                cleanContactList(contact)
                socket.emit('check', {
                    contact: contact
                });
            });
            listEmpty = false;
        }
    });

    socket.on('state', function(data) {
        addNotification(data.state, data.from);
    });

    socket.on('saved', function(data) {
        document.getElementById("fileUpload").value = "";
        if (to.indexOf("conference") > -1) {
        sendMessage(to, data.url, true, true);
        }
        else {
            sendMessage(to, data.url, true, false);
        }

    });

    socket.on('error', function(err) {
        console.log(err);
    });

    socket.on('stanza', function(stanza) {
        console.log(stanza);
    });

    socket.on('status', function(data) {
        receiveMessage("Hello my state now is " + data.state, data.contact);
    });

    socket.on('error', function(data) {
        window.location.replace("http://localhost:3000");
    });

    function cleanContactList(contact) {
        $(".is-active").toggleClass("is-active");
        $(".tab").unbind("click");
        addToContactList(contact.name);
        activateContactList();
    }

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
                toastr.success('is ' + state, 'Contact ' + from);
                break;
            case "away":
                toastr.warning('is ' + state, 'Contact ' + from);
                break;
            case "offline":
                toastr.error('is ' + state, 'Contact ' + from)
                break;
            default:
                toastr.success(state, from);
        }
    }

    function addContact(contact) {
        socket.emit('new', contact);
    }

    function receiveGroupMessage(group, from, message) {
        document.title = "New Message from " + from;
        addNotification(message, group);
        $(document.getElementById(`${group}-chat`)).append(
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

    function sendMessage(to, message, file, group) {
        var text = `${message}`;

        socket.emit('sent', {
            to: to,
            message: message,
            group: group
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

        a.href = "#" + contact;
        a.innerText = contact;
        a.className = "mdl-tabs__tab tab";
        a.id = contact + "-tab";


        div.className = "mdl-tabs__panel";
        div.id = contact;

        innerDiv.className = "chat-message";

        ul.className = "chat";
        ul.id = contact + "-chat";

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

    function deleteContact(contact) {
        socket.emit("delete", {contact:contact});
        $(document.getElementById(contact + "-tab")).remove();
        $(document.getElementById(contact + "-chat")).remove();
        $(".is-active").toggleClass("is-active");
        $(".tab").unbind("click");
        activateContactList();
    }

})(jQuery);