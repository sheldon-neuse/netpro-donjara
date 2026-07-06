const ws = new WebSocket("ws://localhost:3000/ws");
ws.onopen = () => {
    const name = prompt("名前を入力してください");

    playerName.textContent = `名前：${name}`;

    ws.send(JSON.stringify({ // JavaScriptのオブジェクトをJSON形式の文字列に変換する
        type: "username",
        name: name
    }))
};
const myHand = document.getElementById("myHand");
const playerName = document.getElementById("playerName"); // プレイヤー名
function addTileToHand(tile, index) {
    const div = document.createElement("div"); // <div>を新しく作る
    div.className = "tile"; // CSSの.tileを適用する
    const number = document.createElement("div");
    number.className = "tile-number";
    number.textContent = tile.number;
    const img = document.createElement("img");
    img.src = `images/${tile.character}.png`;
    div.appendChild(number);
    div.appendChild(img);

    div.onclick = () => {
        ws.send(JSON.stringify({ // サーバーに捨てる牌を送る
            type: "discard",
            index: index
        }))
    };

    myHand.appendChild(div);
}
ws.onmessage = (event) => {
    // サーバからws.send(...)されるとここ
    const msg = JSON.parse(event.data); // JSONをJavaScriptのオブジェクトへ変換

    switch (msg.type) {

        case "drawResult":
            addTileToHand(msg.tile);
            break;

        case "count":
            document.getElementById("playerCount").textContent =
                `接続人数：${msg.count}人`;
            break;

        case "hand":
            myHand.innerHTML = "";
            msg.hand.forEach((tile, index) => {
                addTileToHand(tile, index);
            });
            break;
    }
};
