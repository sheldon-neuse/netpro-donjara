const protocol = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${protocol}://${location.host}/ws`);
let myName = "";
ws.onopen = () => {
    const name = prompt("名前を入力してください") || "名無し";

    playerName.textContent = `名前：${name}`;
    myName = name;

    ws.send(JSON.stringify({ // JavaScriptのオブジェクトをJSON形式の文字列に変換する
        type: "username",
        name: name
    }))
};
const myHand = document.getElementById("myHand");
const playerName = document.getElementById("playerName"); // プレイヤー名
const myDiscardArea = document.getElementById("myDiscardArea"); // 自分の捨て牌
const opponentDiscardArea = document.getElementById("opponentDiscardArea"); // 相手の捨て牌
const drawTileArea = document.getElementById("drawTileArea"); // ツモ牌
const opponentHand = document.getElementById("opponentHand"); // 相手の持ち牌
const stealButton = document.getElementById("stealButton"); // 横取りボタン
const passStealButton = document.getElementById("passStealButton"); // 横取りしないボタン
const meldArea = document.getElementById("meldArea"); // 自分の横取りエリア
const opponentMeldArea = document.getElementById("opponentMeldArea"); // 相手の横取りエリア
const reachButton = document.getElementById("reachButton"); // リーチボタン
const winButton = document.getElementById("winButton"); // ドンジャラボタン
const cutin = document.getElementById("cutin"); // カットイン演出
const cutinText = document.getElementById("cutinText"); // カットインのテキスト
const cutinImages = document.getElementById("cutinImages"); // カットインの画像
const resultOverlay = document.getElementById("resultOverlay"); // ゲーム終了時のフェード
const resultText = document.getElementById("resultText"); // ゲーム終了時のテキスト
let myTurn = false; // クライアントでもターン管理
let reached = false; // リーチ状態を管理

function createTileElement(tile) { // 牌を表示する
    const div = document.createElement("div");
    div.className = "tile";
    const number = document.createElement("div");
    number.className = "tile-number";
    number.textContent = tile.number;
    const img = document.createElement("img");
    img.src = `images/${tile.character}.png`;
    div.classList.add(tile.character);
    div.appendChild(number);
    div.appendChild(img);
    return div;
}

function addTileToHand(tile, index) { // 牌のクリック処理
    const div = createTileElement(tile);
    div.onclick = () => {
        if (!myTurn || reached) {
            return;
        }
        ws.send(JSON.stringify({ // サーバーに捨てる牌を送る
            type: "discard",
            index: index
        }));
    };

    myHand.appendChild(div);
}

function updateOpponentHand(count) { // 相手の裏面になっている牌の表示
    opponentHand.innerHTML = "";

    for (let i = 0; i < count; i++) {
        const div = document.createElement("div");
        div.className = "tile back";
        // 一番右＝ツモ牌
        if (i === count - 1 && count >= 9) {
            div.classList.add("draw-tile");
        }
        opponentHand.appendChild(div);
    }
}

function showCutin(text, type, characters = []) {
    // リーチ時などのカットイン演出
    cutin.className = "";
    cutinText.textContent = text;

    cutinImages.innerHTML = "";

    // キャラクター画像を追加
    characters.forEach(character => {
        const img = document.createElement("img");
        img.src = `images/${character}.png`;
        cutinImages.appendChild(img);
    });
    cutin.classList.add("show", type);
    setTimeout(() => {
        cutin.classList.remove("show");
        cutinImages.innerHTML = "";
    }, 2000);
}

function showResult(win) {
    // ゲーム結果の表示
    resultText.textContent = win ? "YOU WIN!!" : "YOU LOSE...";
    resultText.className = win ? "win" : "lose";

    resultOverlay.classList.add("show");
    setTimeout(() => {
        resultOverlay.classList.remove("show");
    }, 2500);
}

function resetGameUI() { // UIをリセットする
    reached = false;
    myTurn = false;

    stealButton.style.display = "none";
    passStealButton.style.display = "none";
    reachButton.style.display = "none";
    winButton.style.display = "none";

    myDiscardArea.innerHTML = "";
    opponentDiscardArea.innerHTML = "";
}

stealButton.onclick = () => {
    // 横取りボタンを押したとき
    ws.send(JSON.stringify({
        type: "steal"
    }));

    stealButton.style.display = "none";
    passStealButton.style.display = "none";
};

passStealButton.onclick = () => {
    // 横取りしないボタンを押したとき
    ws.send(JSON.stringify({
        type: "passSteal"
    }));

    stealButton.style.display = "none";
    passStealButton.style.display = "none";
};

reachButton.onclick = () => {
    // リーチボタンを押したとき
    ws.send(JSON.stringify({
        type: "reach"
    }));

    reachButton.style.display = "none";
};

winButton.onclick = () => {
    // ドンジャラボタンを押したとき
    ws.send(JSON.stringify({
        type: "win"
    }));

    winButton.style.display = "none";
};

ws.onmessage = (event) => {
    // サーバからws.send(...)されるとここ
    const msg = JSON.parse(event.data); // JSONをJavaScriptのオブジェクトへ変換

    switch (msg.type) {

        case "count":
            document.getElementById("playerCount").textContent =
                `接続人数：${msg.count}人`;
            break;

        case "hand":
            stealButton.style.display = "none";
            passStealButton.style.display = "none";
            reachButton.style.display = "none";
            winButton.style.display = "none";

            // 横取りした牌をクリックさせない
            meldArea.innerHTML = "";
            msg.melds.forEach(group => {
                const row = document.createElement("div");
                row.className = "meld-group";
                group.forEach(tile => {
                    const div = createTileElement(tile);
                    div.classList.add("meld");
                    row.appendChild(div);
                });
                meldArea.appendChild(row);
            });

            // 相手の横取り牌
            opponentMeldArea.innerHTML = "";
            msg.opponentMelds.forEach(group => {
                const row = document.createElement("div");
                row.className = "meld-group";
                group.forEach(tile => {
                    const div = createTileElement(tile);
                    div.classList.add("opponent-tile");
                    row.appendChild(div);
                });
                opponentMeldArea.appendChild(row);
            });

            myHand.innerHTML = "";
            drawTileArea.innerHTML = "";
            msg.hand.forEach((tile, index) => {
                addTileToHand(tile, index);
            });
            if (msg.drawTile) {
                const div = createTileElement(msg.drawTile);
                div.classList.add("draw-tile");
                div.onclick = () => {
                    if (!myTurn) {
                        return;
                    }
                    ws.send(JSON.stringify({
                        type: "discard",
                        index: -1
                    }));
                };
                drawTileArea.appendChild(div);
            }
            updateOpponentHand(msg.opponentCount);
            break;

        case "discard": {
            const div = createTileElement(msg.tile);
            if (msg.player === myName) {
                myDiscardArea.appendChild(div);
            }
            else {
                div.classList.add("opponent-tile");
                opponentDiscardArea.appendChild(div);
            }
            break;
        }

        case "removeDiscard":
            if (msg.player === myName) {
                if (myDiscardArea.lastElementChild) {
                    myDiscardArea.removeChild(myDiscardArea.lastElementChild);
                }
            } else {
                if (opponentDiscardArea.lastElementChild) {
                    opponentDiscardArea.removeChild(opponentDiscardArea.lastElementChild);
                }
            }
            break;

        case "turn":
            myTurn = msg.myTurn;
            break;

        case "canSteal":
            if (!myTurn) {
                stealButton.style.display = "inline-block";
                passStealButton.style.display = "inline-block";
            }
            break;

        case "canReach":
            reachButton.style.display = "inline-block";
            break;

        case "canWin":
            winButton.style.display = "inline-block";
            break;

        case "reach":
            showCutin("リーチ！", "reach");
            break;

        case "reached":
            reached = true;
            reachButton.style.display = "none";
            break;

        case "win":
            showCutin("ドンジャラ！", "win", msg.characters);
            showResult(msg.winner === myName);

            // もし勝者が相手だった場合、相手の手牌をオープンにする
            if (msg.winner !== myName) {
                opponentHand.innerHTML = ""; // 裏向きの牌を一度クリア

                // 相手の手札（8枚）を表向きで描画
                msg.winnerHand.forEach(tile => {
                    const div = createTileElement(tile);
                    div.classList.add("opponent-tile"); // 必要に応じてスタイルを調整
                    opponentHand.appendChild(div);
                });

                // もし相手にツモ牌（アガリ牌）があれば、それも右側に表示する
                if (msg.winnerDrawTile) {
                    const div = createTileElement(msg.winnerDrawTile);
                    div.classList.add("opponent-tile", "draw-tile");
                    opponentHand.appendChild(div);
                }
            }

            stealButton.style.display = "none";
            passStealButton.style.display = "none";
            reachButton.style.display = "none";
            winButton.style.display = "none";
            break;

        case "clearDiscard":
            myDiscardArea.innerHTML = "";
            opponentDiscardArea.innerHTML = "";
            break;

        case "gameEnd":
            alert("相手が切断しました");
            break;

        case "drawGame":
            alert("山札がなくなりました。引き分けです。");
            break;

        case "newGame":
            reached = false;

            stealButton.style.display = "none";
            passStealButton.style.display = "none";
            reachButton.style.display = "none";
            winButton.style.display = "none";
            break;
    }
};
