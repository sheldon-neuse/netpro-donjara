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
let gameStarted = false; // ゲームスタートの管理
let currentTurn = 0; // ターン管理
let discardPile = []; // 捨て牌管理

// 山札作る
function initDeck() {
    deck = [];

    const characters = [
        "cat",
        "dog",
        "karaage",
        "kitasenju",
        "niwa",
        "pc",
        "pig",
        "ramen",
        "tdu"
    ];

    characters.forEach(character => {
        for (let number = 1; number <= 9; number++) {
            deck.push({
                character,
                number
            })
        }
    })

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
        hand: [],
        drawTile: null
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

                        if(players.length === 2 && !gameStarted){
                            startGame();
                        }
                    }
                }
                break;

            case "discard":
                {
                    const player = players.find(p => p.ws === ws);
                    if(player !== players[currentTurn]){
                        break;
                    }

                    let discardedTile;
                    if(msg.index === -1){ // ツモ牌を捨てるとき
                        discardedTile = player.drawTile;
                        player.drawTile = null;
                    } else { // 持ち牌から捨てるとき
                        discardedTile = player.hand.splice(msg.index, 1)[0];
                        if (player.drawTile) { // ツモ牌があるなら、持ち牌に加える
                            player.hand.push(player.drawTile);
                        }
                        sortHand(player.hand); // 持ち牌をソートする
                        player.drawTile = null;
                    }
                    discardPile.push(discardedTile);
                    broadcast({ // 捨て牌を全員に知らせる
                        type: "discard",
                        tile: discardedTile,
                        player: player.name
                    });
                    const opponent = players.find(p => p !== player);
                    player.ws.send(JSON.stringify({ // そのターンの人の手札管理
                        type: "hand",
                        hand: player.hand,
                        drawTile: player.drawTile,
                        opponentCount: opponent.hand.length + (opponent.drawTile ? 1 : 0)
                    }));
                    currentTurn = (currentTurn + 1) % players.length; // ターン切り替え
                    drawTile(players[currentTurn]);
                    sendTurn();
                }
                break;
        }
    });

    ws.on("close", () => {
        console.log("切断");

        players = players.filter(p => p.ws !== ws);

        if (players.length < 2) {
            gameStarted = false;
            currentTurn = 0;
        }

        broadcastPlayerCount();
    });
});

function getPlayerName(ws) {
    const player = players.find(p => p.ws === ws);
    return player ? player.name : "名無し";
}

function broadcast(data) { // 全員に送る

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

function sortHand(hand){ // 持ち牌ソート
    hand.sort((a, b) => {
        if(a.character === b.character) { // 絵柄が同じときは数字順
            return a.number - b.number;
        }

        // 絵柄が違うなら絵柄順
        return a.character.localeCompare(b.character);
    })
}

function sendTurn() {
    players.forEach((player, index) => {
        player.ws.send(JSON.stringify({
            type: "turn",
            myTurn: index === currentTurn
        }));
    });
}

function dealHand(player) { // 自動配牌
    player.hand = [];
    player.drawTile = null;

    for(let i = 0; i < 8; i ++){
        if(deck.length === 0) break;
        player.hand.push(deck.pop());
    }
}

function startGame() {
    initDeck(); // 山札をリセット

    players.forEach(player => { // 全員に
        dealHand(player); // 配牌
        sortHand(player.hand); // 持ち牌ソート
        player.ws.send(JSON.stringify({ // プレイヤーそれぞれに
            type: "hand",
            hand: player.hand,
            drawTile: player.drawTile,
            opponentCount: opponent.hand.length + (opponent.drawTile ? 1 : 0)
        }));
    });
    gameStarted = true;

    sendTurn();

    drawTile(players[currentTurn]); // 親のプレイヤーが最初にツモる
}

function drawTile(player){ // ツモる
    if(!player){
        return;
    }
    if(deck.length === 0) return;

    if(player.drawTile) {
        return;
    }

    const tile = deck.pop();

    const opponent = players.find(p => p !== player);
    player.drawTile = tile;
    player.ws.send(JSON.stringify({
        type: "hand",
        hand: player.hand,
        drawTile: player.drawTile,
        opponentCount: opponent.hand.length + (opponent.drawTile ? 1 : 0)
    }));
}

initDeck();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});