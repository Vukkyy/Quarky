/**
 * Resolve promise after set amount of ms
 * @param {int} - ms to wait for
 */
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Stores if jumping to the bottom automatically is allowed
window.jumpToBottom = true;

// Stores the current channel
window.currentChannel = null;

/**
 * Stolen code to linkify text, because I am soo lazy. https://stackoverflow.com/a/71734086
 * @param {string} t - Text to linkify.
 * @returns {string} Linkified text.
 */
const linkify = t => {
    const m = t.match(/(?<=\s|^)[a-zA-Z-:/]+\.[a-zA-Z-].+?(?=[.,;:?!-]?(?:\s|$))/g)
    if (!m) return t
    const a = []
    m.forEach(x => {
      const [t1, ...t2] = t.split(x)
      a.push(t1)
      t = t2.join(x)
      const y = (!(x.match(/(http(s?)):\/\//)) ? 'https://' : '') + x
      a.push('<a href="' + y + '" target="_blank">' + y.replace(/^https?:\/\//, '') + '</a>')
    })
    a.push(t)
    return a.join('')
}

/**
 * Get the value of a cookie
 * @param {string} key 
 * @returns {string} - cookie value
 */
function getCookie(key) {
    var keyValue = document.cookie.match('(^|;) ?' + key + '=([^;]*)(;|$)');
    return keyValue ? keyValue[2] : null;
}

/**
 * Escapes HTML, in case they need to be evacuated.
 * @param {string} unsafeText - Text to escape 
 * @returns {string} Escaped text
 */
function escapeHTML(unsafeText) {
    let div = document.createElement('div');
    div.innerText = unsafeText;
    return div.innerHTML;
}

// Redirect to login screen if no token is presemt
if(!getCookie("authToken")) document.location.pathname = "/";
const authToken = getCookie("authToken");

// Quarks
let quarks = {};

// Websocket related variables
let wss; // Actually the websocket
let retryCount = 0; // Amount of connection retries
let welcomeHasFinishedOnce = false; // Keep track of if the welcome flow has finished once
let heartbeat;

/**
 * Initialize Quarky
 * @returns {void}
 */
async function welcome() {
    tippy("#userdata .avie", {
        content: "It's me!",
        appendTo: document.querySelector("#userdata"),
        theme: "black",
        hideOnClick: false,
        animation: "scale",
        inertia: true,
    })
    tippy("#userdata .settings", {
        content: "Settings",
        appendTo: document.querySelector("#userdata"),
        theme: "black",
        hideOnClick: false,
        animation: "scale",
        inertia: true,
        offset: [0, 25]
    })
    changeLoading("Opening gateway connection...")
    openGateway()
    changeLoading("Fetching Quarks...");
    quarks = await quarkFetch();
    quarkRender(quarks);
    changeLoading("Doing the epic transition...");
    document.querySelector("#loader").classList.add("bye");
    new Audio("/assets/sfx/wb.mp3").play();
    welcomeHasFinishedOnce = true;
}

/**
 * Change loading screen text.
 * @param {string} text 
 * @returns {void}
 */
function changeLoading(text) {
    document.querySelector("#loaderexp").innerHTML = text;
}

let quarkTip;
/**
 * Populate quark list and add join & log out buttons
 * Clears old list
 * @param {object} quarks - List of quarks to populate the list with
 * @returns {void}
 */
async function quarkRender(quarks) { // i mean.. that only happens once? yeah true
    let quarkList = document.querySelector("#list");
    quarkList.innerHTML = "";
    quarks.forEach(quark => { // ok i wonder if this actually works it should
        quarkList.innerHTML += `<div class="quark" id="${quark._id}" onmouseenter="new Audio('/assets/sfx/osu-default-hover.wav').play();" onclick="switchQuark('${quark._id}');" data-tippy-content="${quark.name}">
    <img src="${quark.iconUri}">
</div>`
    })
    // Add join and log out buttons
    quarkList.innerHTML += `
            <div class="quark joiner" onmouseenter="new Audio('/assets/sfx/osu-default-hover.wav').play();" onclick="joinQuark();" data-tippy-content="Join a Quark">
                <span style="font-size: 2.88em; margin-left: 0.4em;">+</span>
            </div>
            <div class="quark logout" onmouseenter="new Audio('/assets/sfx/osu-default-hover.wav').play();" onclick="logOut();" data-tippy-content="Log Out :(">
                <span style="font-size: 2.4em; margin-left: 0.4em;">???</span>
            </div>`
    // Create a tippy tooltip if it doesnt already exist
    if (quarkTip) quarkTip.forEach(tip => tip.destroy());
    quarkTip = tippy(`.quark`, { 
        placement: "right",
        theme: "black",
        hideOnClick: false,
        animation: "scale",
        inertia: true,
        followCursor: "vertical",
    });
}
/**
 * Get the user's quarks
 * @returns {object} - Quark array
 */
async function quarkFetch() {
    let quarkResponse = await apiCall("/quark/me");
    if (quarkResponse) return quarkResponse.response.quarks;
}

/**
 * Make call to Lightquark API.
 * Returns false if failed, otherwise returns data.
 * 
 * @param {string} path  - Api endpoint, `/quark/me`
 * @param {"GET" | "POST" | "PATCH" | "PUT" | "DELETE"} method - Default GET
 * @param {object} body - Default empty object
 * @returns {object|false}
 */
 async function apiCall(path, method = "GET", body = {}) {
    let options = {
        method: method,
        headers: {
            "Authorization": `Bearer ${authToken}`,
            "Content-Type": "application/json",
            "User-Agent": "Quawky",
            "lq-agent": "Quawky"
        }
    }
    // GET requests cannot have a body
    if (method !== "GET") options.body = JSON.stringify(body);

    try {
        let res = await fetch(`https://lq.litdevs.org/v1${path}`, options);
        let data = await res.json();
        if (data.request.success) return data; // Success
        if (data.request.status_code === 401)  {
            logOut();
            return false;
        }
        // Failed :(
        alert(`${data.request.status_code}:\n${data.response.message}`)
        return false;
    } catch (e) {
        alert(`Huohhhh. Sewvew doesn't want to tawk :3c\ninfos:${e}`);
        return false;
    }
}

/**
 * Clear the auth cookie and go back to login
 * @returns {void}
 */
function logOut() {
    document.cookie = "authToken=";
    document.location.pathname = "/";
}

/**
 * Join a Quark
 * @returns {void}
 */
async function joinQuark() {
    let quarkCode = prompt("Enter the invite code for the Quark you want to join.");
    if (!quarkCode) return;
    let joinResponse = await apiCall(`/quark/invite/${quarkCode}`, "POST");
    if (!joinResponse) return alert(`Failed to join Quark :(\n${joinResponse.response.message}`)
    quarks = await quarkFetch();
    quarkRender(quarks);
    switchQuark(joinResponse.response.quark._id);
}

/**
 * Changes to another Quark
 * @param {string} id - The ID of the quark to change to.
 * @returns {void}
 */
async function switchQuark(id) {
    new Audio("/assets/sfx/osu-button-select.wav").play();

    document.querySelector("#messagesbox").classList.add("hidden");
    document.querySelector(`.quark[id='${id}']`).classList.remove("stretch");
    void document.querySelector(`.quark[id='${id}']`).offsetWidth;
    document.querySelector(`.quark[id='${id}']`).classList.add("stretch");

    let quark = (await apiCall(`/quark/${id}`)).response.quark;
    document.querySelector("#servername").innerText = quark.name;
    if(quark.channels[0]) switchChannel(quark.channels[0]._id, false)
    channelListRender(quark.channels);
}

/**
 * Populates channel list.
 * @param {array} channels - The list of channels to populate the list with.
 * @returns {void}
 */
async function channelListRender(channels) {
    document.querySelector("#channels").innerHTML = "";
    channels.forEach(channel => {
        document.querySelector("#channels").innerHTML += `
            <div class="channel" id="${channel._id}" onmouseenter="new Audio('/assets/sfx/osu-default-hover.wav').play();" onclick="switchChannel('${channel._id}')">${channel.name}</div>
        `
    })
}

/**
 * Makes the message format make more sense to me.
 * @param {array} message - The message to clean.
 * @returns {object} The cleaned message.
 */
function cleanMessage(message) {
    return {
        ...message.message,
        "author": {
            ...message.author
        }
    }
}

function attachmentTextifier(attachments) {
        let a = ""
        attachments.forEach(attachment => a += `<br>attachment: ${attachment}`)
        return a
}

let adminTip;
/**
 * Renders a message.
 * @param {array} message - The message to render.
 * @returns {void}
 */
function messageRender(message) {
    document.querySelector("#messages").innerHTML += `
    <div class="message">
        <span class="avie">
            <img src="${message.author.avatarUri}" class="loading" onload="this.classList.remove('loading');" onerror="this.classList.remove('loading');this.onload='';this.src='/assets/img/fail.png'">
            ${message.author.admin ? "<img src='/assets/img/adminmark.svg' class='adminmark' width='32' data-tippy-content='I&apos;m a LightQuark developer!'>" : ""}
        </span>
        <span class="lusername">${escapeHTML(message.author.username)} <small class="timestamp">${new Date(message.timestamp).toLocaleString()} via ${escapeHTML(message.ua)}</small></span>
        ${escapeHTML(message.ua) == "Quawky" ? linkify(escapeHTML(message.content)) : owo(linkify(escapeHTML(message.content)))}
        ${message.attachments && message.attachments.length > 0 ? linkify(attachmentTextifier(message.attachments)) : ""}
        <br>
    </div>
    `;
    if(message.author.admin) {
        if (adminTip) adminTip.forEach(tip => tip.destroy()); // destroy old tippies
        adminTip = tippy(`.adminmark`, { // create a tippy for admin marks
            theme: "black",
            hideOnClick: false,
            appendTo: document.querySelector("#messagesbox")
        });
    }
    if(jumpToBottom) document.querySelector("#messagesbox").scrollTop = document.querySelector("#messagesbox").scrollHeight;
}

/**
 * Changes to another channel
 * @param {string} id - The ID of the channel to change to.
 * @param {boolean} audioOn - Play sound effect, defaults to true.
 * @returns {void}
 */
async function switchChannel(id, audioOn = true) {
    if(audioOn) new Audio("/assets/sfx/osu-button-select.wav").play();

    // Handle subscrpiptions
    wss.send(JSON.stringify({event: "subscribe", message: `channel_${id}`}))
    if(currentChannel) wss.send(JSON.stringify({event: "unsubscribe", message: `channel_${currentChannel}`}))
    currentChannel = id;

    document.querySelector("#messagesbox").classList.add("hidden");
    document.querySelector("#messages").innerHTML = "";
    let messages = (await apiCall(`/channel/${id}/messages`)).response.messages;
    messages = messages.sort(function(x,y) {
        return x.message.timestamp - y.message.timestamp;
    });
    messages.forEach(message => {
        messageRender(cleanMessage(message));
    });
    document.querySelector("#messagesbox").classList.remove("hidden");
}

/**
 * Makes sure if auto-scrolling is acceptable or not.
 * @returns {void}
 */
function scrollingDetected() {
    jumpToBottom = Math.abs(document.querySelector("#messagesbox").scrollHeight - document.querySelector("#messagesbox").clientHeight - document.querySelector("#messagesbox").scrollTop) < 1
}

/**
 * Sends a message
 * @param {string} message - The message to send.
 * @returns {void}
 */
async function sendMessage(message) {
    new Audio("/assets/sfx/osu-submit-select.wav").play();
    document.querySelector("#sendmsg").value = "";
    message = message.replace(/\B\/shrug\b/gm, "??\\_(???)_/??");
    apiCall(`/channel/${currentChannel}/messages`, "POST", {"content": message});
}

welcome();
