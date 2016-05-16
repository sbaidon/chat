(function($) {

    var socket = io.connect();
    var username = $("#username").text();
    var to;
    var listEmpty = true;
    var pendingMessages = [];

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
            var contact = $('#modal-delete-contact').val();
            deleteContact(contact);
        });

        $('#btn-logout').on('click', function() {
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

        $("#important-btn").on('click', function() {
            socket.emit("retrieve", {
                to: username,
                from: to
            });
        });

        $("#files-btn").on('click', function() {
            socket.emit("retrieveFiles", {
                to: username,
                from: to
            });
        });

    });

    socket.on('joingroup', function(group) {
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
        var element = document.getElementById(contact.name + "-tab");
        if (!document.contains(element)) {
            cleanContactList(contact);
            createCheckboxes(contact);
        }
    });

    socket.on('received', function(data) {
        if (document.getElementById(`${data.from}-chat`) == null) {
            pendingMessages.push(data);
        }

        if (data.message.indexOf("http") > -1) {
            receiveMessage(data.message, data.from, true);
        } else {
            receiveMessage(data.message, data.from, false);
        }
    });

    socket.on('groupmessage', function(data) {
        receiveGroupMessage(data.conference, data.from, data.message);
    });

    socket.on('roster', function(contacts) {
        $(".mdl-spinner").remove();
        console.log(contacts);
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
        pendingMessages.forEach(function(data) {
            receiveMessage(data.message, data.from, false);
        });
    });

    socket.on('state', function(data) {
        addNotification(data.state, data.from);
    });

    socket.on('saved', function(data) {
        document.getElementById("fileUpload").value = "";
        if (to.indexOf("conference") > -1) {
            sendMessage(to, data.url, true, true);
        } else {
            sendMessage(to, data.url, true, false);
        }

    });

    socket.on('error', function(err) {
        console.log(err);
    });

    socket.on('stanza', function(stanza) {
        console.log(stanza);
    });

    socket.on('retrieveDone', function(data) {
        $("#filtered-messages").empty();
        data.messages.forEach(function(message) {
            filterMessages(message.message, message.from, message.date);
        });
        $("#filterModal").modal()
    });

    socket.on('retrieveFilesDone', function(data) {
        $("#filtered-files").empty();
        data.files.forEach(function(file) {
            listFiles(file.name, file.url, file.from, file.date);
        });
        $("#filterModalFiles").modal()
    });

    socket.on('status', function(data) {
        receiveMessage("Hello my state now is " + data.state, data.contact);
    });

    socket.on('bad', function(data) {
        window.location.replace("https://localhost:3000");
        addNotification(data.err);
    });

    function listFiles(name, url, from, date) {
        var filter = $("#filtered-files");
        filter.append(
            `<span class="chat-img pull-left">
            <img src="http://bootdey.com/img/Content/user_1.jpg" alt="User Avatar"/></span>
           <div class="chat-body clearfix">
            <div class="header"><strong class="primary-font">${from}</strong>
            <small class="pull-right text-muted">
            <i class="fa fa-clock-o"></i>${date}</small>
            </div>
             <a href="${url}" id="chat-text">${name}</a>
          </div>
        `
        );


    }

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

    function filterMessages(message, from, date) {
        var filter = $("#filtered-messages");
        filter.append(
            `<span class="chat-img pull-left">
            <img src="http://bootdey.com/img/Content/user_1.jpg" alt="User Avatar"/></span>
           <div class="chat-body clearfix">
            <div class="header"><strong class="primary-font">${from}</strong>
            <small class="pull-right text-muted">
            <i class="fa fa-clock-o"></i>${date}</small>
            </div>
             <p id="chat-text">${message}</p>
          </div>
        `
        );

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

    function receiveMessage(message, from, file, important) {
        var importantM = ""
        if (important || message.indexOf("IMPORTANT") > -1) {
            importantM = "background-color:salmon";
            message = message.substring(10, message.length);
        }

        var text = `${message}`;

        if (file) {
            text = `<a href="${message}">${message}</a>`
        }

        document.title = "New Message from " + from;
        addNotification(message, from);

        $(document.getElementById(`${from}-chat`)).append(
            `<li class="left clearfix"><span class="chat-img pull-left">
            <img src="http://bootdey.com/img/Content/user_1.jpg" alt="User Avatar"/></span>
           <div class="chat-body clearfix" style="${importantM}">
            <div class="header"><strong class="primary-font">${from}</strong>
            <small class="pull-right text-muted">
            <i class="fa fa-clock-o"></i>Just Now</small>
            </div>
             <p id="chat-text">${text}</p>
          </div>
        </li>`
        );
    }

    function sendMessage(to, message, file, group) {

        if ($('input[name="chk[]"]:checked').length > 0) {

            var text = `${message}`;

            if (file) {
                text = `<a href="${message}">${message}</a>`
            }

            $(document.getElementById(to + "-chat")).append(
                `<li class="right clearfix"><span class="chat-img pull-right">
                <img src="http://bootdey.com/img/Content/user_1.jpg" alt="User Avatar"/></span>
                  <div class="chat-body clearfix" style="background-color:salmon">
                    <div class="header"><strong class="primary-font">${username}</strong>
                    <small class="pull-right text-muted"><i class="fa fa-clock-o"></i>A while ago</small></div>
                     <p id="chat-text" >${text}</p>
                  </div>
                </li>`
            );
            $('#chat-input').val("");

            socket.emit("important", {
                message: message,
                to: to,
                from: username,
            });

            message = "IMPORTANT \n" + message;
        } else {

            var text = `${message}`;



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
        }
        socket.emit('sent', {
            to: to,
            message: message,
            group: group
        });
        $('#chat-input').val("");
    }

    function addToContactList(contact) {
        console.log("contact list", contact);
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
        socket.emit("delete", {
            contact: contact
        });
        $(document.getElementById(contact + "-tab")).remove();
        $(document.getElementById(contact)).remove();
        $(document.getElementById(contact + "-chat")).remove();
        $(".is-active").toggleClass("is-active");
        $(".tab").unbind("click");
        activateContactList();
    }

})(jQuery);