// ライブラリの読み込み
const express = require("express");
const expressWs = require("express-ws"); // ExpressでWebSocketを使えるようにするライブラリ

// サーバ作成
const app = express();
expressWs(app);

const PORT = process.env.PORT || 3000;

// publicフォルダを公開
app.use(express.static("public"));

// 接続中のプレイヤー
let players = [];
let deck = [];

// 山札作る
function initDeck() {
    deck = [];

    const tiles = ["A", "B", "C", "D", "E"];

    for (let i = 0; i < 9; i++) {
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
        name: "名無し",
        hand: []
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
                        player.name = msg.name; // ユーザ名の入力

                        dealHand(player); // 接続時に自動配牌
                        ws.send(JSON.stringify({
                            type: "hand",
                            hand: player.hand
                        }));
                    }
                }
                break;

            case "draw":
                {
                    const player = players.find(p => p.ws === ws);
                    if(!player) break;

                    const tile = deck.pop();

                    ws.send(JSON.stringify({
                        type: "drawResult",
                        tile
                    }));
                }
                break;

            case "discard":
                console.log(getPlayerName(ws), "が牌を捨てました");

                if(!player) break;

                player.hand.splice(msg.index, 1);
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

function broadcastPlayerCount() { // プレイヤー人数

    broadcast({
        type: "count",
        count: players.length
    });

}

function dealHand(player) { // 自動配牌
    player.hand = [];

    for(let i = 0; i < 5; i ++){
        if(deck.length === 0) break;
        player.hand.push(deck.pop());
    }
}

initDeck();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});