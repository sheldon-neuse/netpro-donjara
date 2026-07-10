const ws = new WebSocket("ws://localhost:3000/ws");
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
const opponentHand = document.getElementById("opponentHand");
let myTurn = false; // クライアントでもターン管理

function createTileElement(tile){ // 牌を表示する
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
        if(!myTurn){
            return;
        }
        ws.send(JSON.stringify({ // サーバーに捨てる牌を送る
            type: "discard",
            index: index
        }));
    };

    myHand.appendChild(div);
}

function updateOpponentHand(count){ // 相手の裏面になっている牌の表示
    opponentHand.innerHTML = "";

    for(let i = 0; i < count; i++){
        const div = document.createElement("div");
        div.className = "tile back";
        opponentHand.appendChild(div);
    }
}

ws.onmessage = (event) => {
    // サーバからws.send(...)されるとここ
    const msg = JSON.parse(event.data); // JSONをJavaScriptのオブジェクトへ変換

    switch (msg.type) {

        case "count":
            document.getElementById("playerCount").textContent =
                `接続人数：${msg.count}人`;
            break;

        case "hand":
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

        case "turn":
            myTurn = msg.myTurn;
            break;
    }
};
