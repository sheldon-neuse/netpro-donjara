const ws = new WebSocket("ws://localhost:3000/ws");
const myHand = document.getElementById("myHand");
const drawButton = document.getElementById("drawButton");
function addTileToHand(tile) {
    const div = document.createElement("div");
    div.className = "tile";
    div.textContent = tile;

    div.onclick = () => {
        div.remove();
    };

    myHand.appendChild(div);
}
ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    switch (msg.type) {

        case "drawResult":
            addTileToHand(msg.tile);
            break;

        case "count":
            document.getElementById("playerCount").textContent =
                `接続人数：${msg.count}人`;
            break;
    }
};
drawButton.onclick = () => {
    ws.send(JSON.stringify({
        type: "draw"
    }));
};
