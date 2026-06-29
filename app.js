const express = require("express");
const expressWs = require("express-ws");

const app = express();
expressWs(app);

const PORT = process.env.PORT || 3000;

// publicフォルダを公開
app.use(express.static("public"));

// 接続中のプレイヤー
let players = [];
let deck = [];

function initDeck() {
    deck = [];

    const tiles = ["A", "B", "C", "D", "E"];

    for (let i = 0; i < 4; i++) {
        tiles.forEach(t => deck.push(t));
    }

    shuffle(deck);
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

app.ws("/ws", (ws, req) => {
    console.log("プレイヤーが接続しました");

    players.push({
        ws,
        name: "名無し"
    });

    broadcastPlayerCount();

    ws.on("message", (message) => {
        const msg = JSON.parse(message);

        console.log(msg);

        switch (msg.type) {

            case "username":
                {
                    const player = players.find(p => p.ws === ws);
                    if (player) {
                        player.name = msg.name;
                    }
                }
                break;

          case "draw":
            {
              const tile = deck.pop();

              ws.send(JSON.stringify({
                type: "drawResult",
                tile
              }));
            }
            break;

            case "discard":
                console.log(getPlayerName(ws), "が牌を捨てました");
                break;
        }
    });

    ws.on("close", () => {
        console.log("切断");

        players = players.filter(p => p.ws !== ws);

        broadcastPlayerCount();
    });
});

function getPlayerName(ws) {
    const player = players.find(p => p.ws === ws);
    return player ? player.name : "名無し";
}

function broadcast(data) {

    const message = JSON.stringify(data);

    players.forEach(player => {
        if (player.ws.readyState === 1) {
            player.ws.send(message);
        }
    });
}

function broadcastPlayerCount() {

    broadcast({
        type: "count",
        count: players.length
    });

}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});