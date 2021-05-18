const { ipcRenderer } = require('electron')

function clearHistory () {
    ipcRenderer.send('clear-history', '')
}

var checkboxes = document.querySelectorAll("input[type=radio][name=mode]");
var mode = []

checkboxes.forEach(function (checkbox) {
    checkbox.addEventListener('change', function () {
        mode =
            Array.from(checkboxes)
                .filter(i => i.checked)
                .map(i => i.id)
        ipcRenderer.send('switch-mode', mode[0])

        if (mode[0] == 'rekordbox') {
            document.getElementById('header').innerHTML = `<h6>You're now logging your Rekordbox history</h6>
            <h6 id="headerHands"></h6>`;
            document.getElementById('kuvo_url').style['display'] = 'block';
        }
        if (mode[0] == 'serato') {
            document.getElementById('header').innerHTML = `<h6>You're now logging your Serato history</h6>
            <h6 id="headerHands"></h6>`;
            document.getElementById('kuvo_url').style['display'] = 'None';
        }

        if (mode[0] == 'traktor') {
            document.getElementById('header').innerHTML = `<h6>You're now logging your Traktor history</h6>
            <h6 id="headerHands"></h6>`;
            document.getElementById('kuvo_url').style['display'] = 'None';
        }

        if (mode[0] == 'mixxx') {
            document.getElementById('header').innerHTML = `<h6>You're now logging your Mixxx history</h6>
            <h6 id="headerHands"></h6>`;
            document.getElementById('kuvo_url').style['display'] = 'None';
        }

        document.getElementById('headerHands').innerText = '🙌';

    })
});

var colorPicker = new iro.ColorPicker('#picker', { color: "rgb(222, 0, 89)" });

var hexInput = document.getElementById("hexInput");

colorPicker.on('color:change', function (color) {
    ipcRenderer.send('asynchronous-message', color.hexString)
    hexInput.value = color.hexString;
    document.getElementById('now_playing').style = `background-color:` + color.hexString;
});

hexInput.addEventListener('change', function () {
    colorPicker.color.hexString = this.value;
});

var kuvoInput = document.getElementById("kuvoinput");

kuvoInput.addEventListener('input', function () {
    ipcRenderer.send('kuvoInput-message', this.value)
});


ipcRenderer.on('track-update', (event, arg) => {
    document.getElementById('id_header').innerHTML = `Here's the last track that we logged: <b><p id="last_log">` + arg + "</p></b>";
})

 document.getElementById('kuvoform').addEventListener('submit', function(e) {
    e.preventDefault();
});

function copyElementText(id) {
    var id_map = {asot: "http://localhost:8080/asot.html", 
                now_playing: "http://localhost:8080/now_playing.html", 
                now_playing_right: "http://localhost:8080/now_playing_right.html",
                play_history: "http://localhost:8080/play_history.html",
                next_up: "http://localhost:8080/next_up.html"}
    var text = id_map[id];
    var elem = document.createElement("textarea");
    document.body.appendChild(elem);
    elem.value = text;
    elem.select();
    document.execCommand("copy");
    document.body.removeChild(elem);
    document.getElementById('overlay_selection').innerText = text + ' copied to clipboard';
}