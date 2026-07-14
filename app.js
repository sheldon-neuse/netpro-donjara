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
let lastDiscard = null; // 最後に捨てられた牌
let waitingSteal = false; // 横取り待ち状態かの判定

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
        drawTile: null,
        melds: [],
        reach: false
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

                        if (players.length === 2 && !gameStarted) {
                            startGame();
                        }
                    }
                }
                break;

            case "discard":
                {
                    const player = players.find(p => p.ws === ws);
                    if (player !== players[currentTurn] || waitingSteal) {
                        break;
                    }

                    if (player.reach && msg.index !== -1) {
                        break;
                    }

                    discardTile(player, msg.index);

                }
                break;

            case "steal":
                {
                    const player = players.find(p => p.ws === ws);
                    const opponent = players.find(p => p !== player);
                    if (!player) {
                        break;
                    }
                    // 横取り待ちじゃない || 最後の捨て牌がない || 本当に横取りできるか再確認 || 自分の捨て牌ではない
                    if (!waitingSteal || !lastDiscard || !canSteal(player) || lastDiscard.player === player) {
                        break;
                    }

                    waitingSteal = false;
                    // 手札から同じキャラクターの牌を2枚取り出す
                    const stealTiles = [];
                    for (let i = player.hand.length - 1; i >= 0; i--) {
                        if (
                            player.hand[i].character === lastDiscard.tile.character &&
                            stealTiles.length < 2
                        ) {
                            stealTiles.push(player.hand.splice(i, 1)[0]);
                        }
                    }
                    // 横取り牌として保存
                    const meld = [...stealTiles, lastDiscard.tile];
                    // 数字でもソート
                    meld.sort((a, b) => a.number - b.number);
                    player.melds.push(meld);

                    sortHand(player.hand);

                    const discarder = lastDiscard.player;
                    // 場から削除
                    discardPile.pop();
                    broadcast({
                        type: "removeDiscard",
                        player: discarder.name
                    })
                    lastDiscard = null;
                    // 手札更新
                    updateHands();
                    // 横取りした人のターン
                    currentTurn = players.indexOf(player);
                    sendTurn();
                }
                break;

            case "passSteal":
                {
                    const player = players.find(p => p.ws === ws);
                    if (!waitingSteal || player === lastDiscard.player) {
                        break;
                    }

                    const discarder = lastDiscard.player;
                    waitingSteal = false;
                    currentTurn = (currentTurn + 1) % players.length;
                    drawTile(players[currentTurn]);
                    updateHands();
                    lastDiscard = null;
                    sendTurn();
                }
                break;

            case "reach":
                {
                    const player = players.find(p => p.ws === ws);
                    // 自分のターンではない、またはすでに牌を捨てた後（drawTileがない）なら処理しない
                    if (player !== players[currentTurn] || !player.drawTile) {
                        break;
                    }
                    if (!player || !canReach(player)) {
                        break;
                    }
                    reach(player);
                    player.ws.send(JSON.stringify({
                        type: "reached"
                    }));
                    let index = getReachDiscardIndex(player);
                    discardTile(player, index);
                }
                break;

            case "win":
                {
                    const player = players.find(p => p.ws === ws);
                    if (!player) {
                        break;
                    }
                    // 上がれるか再確認
                    if (!canWin(player)) {
                        break;
                    }
                    broadcast({
                        type: "win",
                        winner: player.name,
                        winnerHand: player.hand,
                        winnerDrawTile: player.drawTile
                    });
                    gameStarted = false;
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
            broadcast({
                type: "gameEnd"
            });
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

function sendHand(player) {
    const opponent = players.find(p => p !== player);

    player.ws.send(JSON.stringify({
        type: "hand",
        hand: player.hand,
        drawTile: player.drawTile,
        melds: player.melds,
        opponentCount: opponent
            ? (opponent.hand.length + (opponent.drawTile ? 1 : 0))
            : 0,
        opponentMelds: opponent
            ? opponent.melds
            : []
    }));
}

function sortHand(hand) { // 持ち牌ソート
    hand.sort((a, b) => {
        if (a.character === b.character) { // 絵柄が同じときは数字順
            return a.number - b.number;
        }

        // 絵柄が違うなら絵柄順
        return a.character.localeCompare(b.character);
    })
}

function canSteal(player) { // 横取りできるかどうか
    if (!player || !lastDiscard) {
        return false;
    }

    let count = player.hand.filter(tile =>
        tile.character === lastDiscard.tile.character
    ).length;
    if (player.drawTile && player.drawTile.character === lastDiscard.tile.character) {
        count++;
    }
    return count >= 2;
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
    player.melds = [];
    player.reach = false;

    for (let i = 0; i < 8; i++) {
        if (deck.length === 0) break;
        player.hand.push(deck.pop());
    }
}

function startGame() {
    // 全部を山札をリセット
    initDeck();
    discardPile = [];
    lastDiscard = null;
    waitingSteal = false;
    currentTurn = 0;

    players.forEach(player => { // 全員に
        dealHand(player); // 配牌
        sortHand(player.hand); // 持ち牌ソート
        sendHand(player);
    });
    gameStarted = true;

    broadcast({
        type: "clearDiscard"
    });

    sendTurn();

    drawTile(players[currentTurn]); // 親のプレイヤーが最初にツモる
    broadcast({
        type: "newGame"
    });
}

function drawTile(player) { // ツモる
    if (!player || player.drawTile) {
        return;
    }
    if (deck.length === 0) {
        broadcast({
            type: "drawGame"
        });
        return;
    }

    const tile = deck.pop();

    player.drawTile = tile;
    sendHand(player);
}

function discardTile(player, index) {
    let discardedTile;
    if (index === -1) {
        // ツモ牌を捨てる
        discardedTile = player.drawTile;
        player.drawTile = null;
    } else {
        if (index >= player.hand.length || index < 0) {
            return false;
        }
        discardedTile = player.hand.splice(index, 1)[0];
        if (player.drawTile) { // ツモ牌があるなら、持ち牌に加える
            player.hand.push(player.drawTile);
        }
        sortHand(player.hand);
        player.drawTile = null;
    }
    discardPile.push(discardedTile);
    lastDiscard = {
        tile: discardedTile,
        player: player
    };
    broadcast({ // 全員に捨て牌を知らせる
        type: "discard",
        tile: discardedTile,
        player: player.name
    });
    const opponent = players.find(p => p !== player);
    if (opponent && canSteal(opponent)) {
        waitingSteal = true;
        updateHands();
        opponent.ws.send(JSON.stringify({
            type: "canSteal",
            tile: discardedTile
        }));
        return true;
    }
    waitingSteal = false;
    currentTurn = (currentTurn + 1) % players.length;
    drawTile(players[currentTurn]);
    updateHands();
    sendTurn();
    return true;
}

function countGroups(tiles) { // 揃っている牌をカウントする
    const count = {};
    tiles.forEach(tile => {
        count[tile.character] = (count[tile.character] || 0) + 1;
    });
    let groups = 0;
    for (const c of Object.values(count)) {
        groups += Math.floor(c / 3);
    }
    return groups;
}

function canReach(player) { // リーチできるかどうか
    if (player.reach) {
        return false;
    }
    const tiles = [...player.hand];
    if (player.drawTile) {
        tiles.push(player.drawTile);
    }
    const groups = countGroups(tiles);
    if (player.melds.length + groups !== 2) {
        return false;
    }
    // 各絵柄の枚数を数える
    const counts = {};
    tiles.forEach(tile => {
        counts[tile.character] = (counts[tile.character] || 0) + 1;
    });
    // 組を除いた余りが2枚あるか調べる
    for (const count of Object.values(counts)) {
        if (count % 3 === 2) {
            return true;
        }
    }
    return false;
}

function reach(player) {
    player.reach = true;
    broadcast({
        type: "reach",
        player: player.name
    })
}

function getReachDiscardIndex(player) { // リーチ時のいらない牌を探す
    const tiles = [...player.hand];
    if (player.drawTile) {
        tiles.push(player.drawTile);
    }
    // すべての牌の「絵柄」の枚数をカウント
    const charCounts = {};
    tiles.forEach(tile => {
        charCounts[tile.character] = (charCounts[tile.character] || 0) + 1;
    });
    // 絵柄の枚数を3で割ったときに1余る（＝セットになっていない）絵柄を探す
    const targetChar = Object.keys(charCounts).find(char => charCounts[char] % 3 === 1);
    // もし見つからなければ、ツモ牌を返す（安全弁）
    if (!targetChar) {
        return -1;
    }
    // その絵柄の中で「3枚組」になっていない孤立した牌（数字）を特定する
    // ドンジャラは同牌が最大9枚（1〜9）あるため、同じ絵柄の中で数字ごとの枚数をカウント
    const numCounts = {};
    const sameCharTiles = tiles.filter(t => t.character === targetChar);
    sameCharTiles.forEach(tile => {
        numCounts[tile.number] = (numCounts[tile.number] || 0) + 1;
    });
    // 3で割り切れない（1枚または2枚しかない）数字の牌を探す
    const targetNum = Object.keys(numCounts).find(num => numCounts[num] % 3 !== 0);
    // 対象の牌（オブジェクト）を特定
    const targetTile = sameCharTiles.find(t => t.number === Number(targetNum)) || sameCharTiles[0];
    // ツモ牌が対象なら -1 を返す
    if (player.drawTile &&
        player.drawTile.character === targetTile.character &&
        player.drawTile.number === targetTile.number) {
        return -1;
    }

    // 手札の何番目にあるかを探してインデックスを返す
    return player.hand.findIndex(tile =>
        tile.character === targetTile.character &&
        tile.number === targetTile.number
    );
}

function canWin(player) { // 勝ち条件の判定
    if (!player.reach) {
        return false;
    }
    const tiles = [...player.hand];
    if (player.drawTile) {
        tiles.push(player.drawTile);
    }
    return player.melds.length + countGroups(tiles) === 3;
}

function updateHands() {
    players.forEach(player => {
        sendHand(player);
        if (canReach(player)) {
            player.ws.send(JSON.stringify({
                type: "canReach"
            }));
        }
        if (canWin(player)) {
            player.ws.send(JSON.stringify({
                type: "canWin"
            }));
        }
    });
}

initDeck();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});