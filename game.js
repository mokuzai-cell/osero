// ==========================================
// 1. ゲームの設定と、データを保存する変数
// ==========================================

// オセロ盤の1辺のマスの数（8マス）
const BOARD_SIZE = 8;
// オセロ盤の画面上の横幅と縦幅（400ピクセル）
const BOARD_PX = 400;
// 1マスのサイズを計算（400ピクセル ÷ 8マス ＝ 50ピクセル）
const CELL_PX = BOARD_PX / BOARD_SIZE;

// 演出の待ち時間（300ミリ秒 ＝ 0.3秒）
const DELAY = 300;

// オセロ盤のマス目のデータを保存する2次元配列（箱の中にさらに箱が入っている構造）
// 0が入っているとき ＝ 空白（石がない）
// 1が入っているとき ＝ 黒い石がある
// 2が入っているとき ＝ 白い石がある
let board = new Array(BOARD_SIZE);
for (let i = 0; i < board.length; i++) {
    board[i] = new Array(BOARD_SIZE);
}

// HTMLの中にあるCanvas（お絵かきエリア）をコントロールするための変数
let boardObj;
let boardContext;

// 現在のプレイヤー（最初は 1:黒 のターンからスタート）
let currentTurn = 1;

// 石がひっくり返っているアニメーション演出中かどうかを覚える変数
// 演出中にプレイヤーが連打してバグるのを防ぐために使います（falseは演出中ではないという意味）
let isAnimating = false;

// オートモードのタイマー（時計）の情報を入れておく変数
let autoModeInterval = null;


// ==========================================
// 2. 画面に図形（マスや石）を描画する関数
// ==========================================

/**
 * 盤面の初期配置を設定し、最初の画面を描画する関数
 */
function initialize() {
    // 盤面のサイズが奇数（7x7など）だったらエラーを出して止める安全装置
    if (BOARD_SIZE % 2 != 0) {
        throw new Error("BOARD_SIZEは偶数にしてください。");
    }

    // 最初にすべてのマスを「0（空白）」で埋める
    for (let i = 0; i < board.length; i++) {
        for (let j = 0; j < board[i].length; j++) {
            board[i][j] = 0;
        }
    }

    // オセロのルール通り、真ん中の4マスに初期の石をクロスで配置する
    // 1:黒、2:白
    board[BOARD_SIZE / 2 - 1][BOARD_SIZE / 2 - 1] = 2; // 左上は白
    board[BOARD_SIZE / 2][BOARD_SIZE / 2] = 2;         // 右下は白
    board[BOARD_SIZE / 2 - 1][BOARD_SIZE / 2] = 1;     // 右上は黒
    board[BOARD_SIZE / 2][BOARD_SIZE / 2 - 1] = 1;     // 左下は黒

    // HTMLからCanvasの要素をJavaScriptに読み込む
    boardObj = document.getElementById("board");
    // 2D（平面）の描画機能を使えるようにする
    boardContext = boardObj.getContext("2d");

    // 画面にすべてのマスと石を描画する
    drawFullBoard(boardContext);
}

/**
 * 指定された1つのマスに、背景や枠線、石を描画する関数
 * 引数の最後に「customColor」を指定すると、黄色などの特別な色で石（丸）を描けます
 */
function drawCell(x, y, color, context, customColor = null) {
    // マス目の番号（0〜7）を、実際の画面の座標（ピクセル）に変換する
    const targetX = x * CELL_PX;
    const targetY = y * CELL_PX;
    
    // 1. マスの背景（緑色）を塗りつぶして描く
    context.fillStyle = "green";
    context.fillRect(targetX, targetY, CELL_PX, CELL_PX);
    
    // 2. マスの枠線（黒色）を描く
    context.strokeStyle = "black";
    context.strokeRect(targetX, targetY, CELL_PX, CELL_PX);

    // 3. 特別な色（黄色や半透明の黄色）が指定されている場合の処理
    if (customColor !== null) {
        context.fillStyle = customColor;
        context.beginPath();
        // マスの真ん中に少し小さめの丸を描く
        context.arc(targetX + CELL_PX / 2, targetY + CELL_PX / 2, CELL_PX / 2 - 2, 0, Math.PI * 2);
        context.fill();
        return; // 特別な色を描いたら、ここでこの関数の処理を終了する
    }

    // 4. 通常の石（黒または白）を描く処理
    if (color == 1) {
        // 黒い石を描く
        context.fillStyle = "black";
        context.beginPath();
        context.arc(targetX + CELL_PX / 2, targetY + CELL_PX / 2, CELL_PX / 2 - 2, 0, Math.PI * 2);
        context.fill();
    } else if (color == 2) {
        // 白い石を描く
        context.fillStyle = "white";
        context.beginPath();
        context.arc(targetX + CELL_PX / 2, targetY + CELL_PX / 2, CELL_PX / 2 - 2, 0, Math.PI * 2);
        context.fill();
    }
}

/**
 * 盤面のすべてのマス（8x8＝64マス）を上から順番にすべて描き直す関数
 */
function drawFullBoard(context) {
    for (let i = 0; i < board.length; i++) {
        for (let j = 0; j < board[i].length; j++) {
            // board[i][j]の中身（0:空、1:黒、2:白）を見て1マスずつ描く
            drawCell(j, i, board[i][j], context);
        }
    }
}


// ==========================================
// 3. オセロの判定ルール（核心部分）
// ==========================================

/**
 * 指定したマス(x, y)に、指定した色(color)を置いたとき、
 * 「ひっくり返せる相手の石の座標」をすべて探してリスト（配列）にして返す関数
 */
function getChangeColor(x, y, color) {
    // もしすでに石がある場所なら、どこもひっくり返せないので空っぽのリストを返す
    if (board[y][x] !== 0) {
        return [];
    }

    // 相手の石の色を計算する（自分が1:黒なら相手は2:白、自分が2:白なら相手は1:黒）
    let opponentColor;
    if (color === 1) {
        opponentColor = 2;
    } else {
        opponentColor = 1;
    }

    // ひっくり返せると確定した石の座標を入れていくリスト
    let flippedPositions = [];

    // 調べる方向（上、下、左、右、右上、右下、左上、左下）の8つのベクトルデータ
    const directions = [
        { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
        { dx: 1, dy: -1 }, { dx: 1, dy: 1 },
        { dx: -1, dy: -1 }, { dx: -1, dy: 1 }
    ];

    // 8つの方向を1つずつ順番に調べていくループ
    for (let i = 0; i < directions.length; i++) {
        const dir = directions[i];
        
        // 今調べているマスから、その方向に1マス進んだ座標を計算する
        let currentX = x + dir.dx;
        let currentY = y + dir.dy;
        
        // この方向に相手の石が何個並んでいるかを一時的に記録するリスト
        let potentialFlips = [];

        // 盤面の外に出ない、かつ、進んだ先に「相手の石」がある間はずっと進み続ける
        while (
            currentX >= 0 && currentX < BOARD_SIZE &&
            currentY >= 0 && currentY < BOARD_SIZE &&
            board[currentY][currentX] === opponentColor
        ) {
            // 相手の石の座標を一時キープ
            potentialFlips.push({ x: currentX, y: currentY });
            // さらに同じ方向に1マス進む
            currentX += dir.dx;
            currentY += dir.dy;
        }

        // ループが止まった場所（相手の石が途切れた場所）が、盤面の中で、かつ「自分の石」だった場合
        if (
            currentX >= 0 && currentX < BOARD_SIZE &&
            currentY >= 0 && currentY < BOARD_SIZE &&
            board[currentY][currentX] === color
        ) {
            // 相手の石を自分の石で「挟んだ」ことになるので、一時キープしていた石を「確定リスト」に移す
            for (let j = 0; j < potentialFlips.length; j++) {
                flippedPositions.push(potentialFlips[j]);
            }
        }
    }

    // 最終的に見つかったひっくり返せる石のリストを返す
    return flippedPositions;
}

/**
 * 現在のターンのプレイヤーが、盤面全体のどこに置けるかのリスト（配列）を作って返す関数
 */
function getMovableCells(color) {
    let movableCells = [];

    // 全てのマス（64マス）を1つずつチェックするループ
    for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
            // そのマスに石を置いたときに、ひっくり返る石があるかを調べる
            let flips = getChangeColor(x, y, color);
            
            // ひっくり返る石が1つ以上あれば、そこは「置ける場所」としてリストに追加する
            if (flips.length > 0) {
                movableCells.push({ x: x, y: y });
            }
        }
    }
    return movableCells;
}


// ==========================================
// 4. ゲームの進行と画面（文字）の更新
// ==========================================

/**
 * 画面上の文字（現在のターン表示や、ログの文章）を更新する関数
 */
function updateUI(message = "") {
    const turnEl = document.getElementById("turn");
    const logEl = document.getElementById("log");
    
    // 1. 現在のターンを画面の上部に表示する
    if (turnEl !== null) {
        if (currentTurn === 1) {
            turnEl.textContent = "現在のターン: ● 黒";
        } else {
            turnEl.textContent = "現在のターン: ○ 白";
        }
    }
    
    // 2. ログメッセージがあれば、HTMLの <div id="log"> の中に追加する
    if (logEl !== null && message !== "") {
        const newLog = document.createElement("p");
        newLog.textContent = message;
        newLog.style.margin = "4px 0";
        // 新しいログが一番上（最新）にくるように差し込む
        logEl.insertBefore(newLog, logEl.firstChild);
    }

    // 3. 盤面を一度きれいに描き直す
    drawFullBoard(boardContext);

    // 4. アニメーション中（演出中）でなければ、「次に自分が置ける場所」をうっすら黄色（半透明）で描く
    if (isAnimating === false) {
        let movable = getMovableCells(currentTurn);
        for (let i = 0; i < movable.length; i++) {
            const pos = movable[i];
            // 最後の引数に半透明の黄色(rgba)を指定してガイドを表示
            drawCell(pos.x, pos.y, 0, boardContext, "rgba(255, 255, 0, 0.4)");
        }
    }
}

/**
 * プレイヤーがマスをクリックしたときに動く、ゲーム進行のメイン関数
 * （演出のタイマーを扱うため、頭に「async」という特別なキーワードをつけています）
 */
async function handleCellClick(x, y) {
    // 演出中である、または、すでに石があるマスなら何もしないで無視する
    if (isAnimating === true || board[y][x] !== 0) {
        return;
    }

    // クリックされたマスに置いたとき、ひっくり返る石のリストを取得する
    let flips = getChangeColor(x, y, currentTurn);
    
    // ひっくり返せる石が0個（＝ルール上置けない場所）なら、何もしないで無視する
    if (flips.length === 0) {
        return;
    }

    // 処理が始まったので「演出中フラグ」をtrue（進行中）にする
    isAnimating = true;

    // 置いた場所をログにテキストとして報告する
    let colorName;
    if (currentTurn === 1) {
        colorName = "黒";
    } else {
        colorName = "白";
    }
    updateUI(colorName + "が (" + (x + 1) + ", " + (y + 1) + ") に石を置きました。");

    // ─── ここからご要望の演出ステップ ───

    // 【ステップ1】置いた場所に、自分の石をすぐに配置して描画する
    board[y][x] = currentTurn;
    drawCell(x, y, currentTurn, boardContext);

    // 【ステップ2】連鎖して裏返る予定の石を、画面上で一瞬「真っ黄色」に塗りつぶす
    for (let i = 0; i < flips.length; i++) {
        const pos = flips[i];
        drawCell(pos.x, pos.y, 0, boardContext, "yellow");
    }

    // 【ステップ3】指定された時間（DELAY ＝ 0.3秒）だけ、プログラムを一時停止させて待つ
    await new Promise(function(resolve) {
        setTimeout(resolve, DELAY);
    });

    // 【ステップ4】待ち時間が終わったら、内部データを書き換えて正式に自分の色にひっくり返す
    for (let i = 0; i < flips.length; i++) {
        const pos = flips[i];
        board[pos.y][pos.x] = currentTurn;
    }
    
    // 演出が終わったので「演出中フラグ」をfalse（終了）に戻す
    isAnimating = false;

    // 【ステップ5】次のターンの判定（パスやゲーム終了のチェック）に進む
    changeTurn();
}

/**
 * ターンを交代させる関数（パスの判定や、ゲーム終了の判定もここで行います）
 */
function changeTurn() {
    // ターンを交代する（1なら2に、2なら1にする）
    if (currentTurn === 1) {
        currentTurn = 2;
    } else {
        currentTurn = 1;
    }
    
    // 交代した相手が、どこか1マスでも置ける場所があるかを調べる
    let movable = getMovableCells(currentTurn);

    if (movable.length > 0) {
        // 置ける場所があるなら、通常通り次のターンへ画面を更新して終了
        updateUI();
        return;
    }

    // ── 相手が置ける場所がない場合（パスの処理） ──
    let passedColor;
    if (currentTurn === 1) {
        passedColor = "黒";
    } else {
        passedColor = "白";
    }
    // ログにパスしたことを書き込む
    updateUI(passedColor + "に置ける場所がないため、パスします。");
    
    // ターンを自分（さっき打った人）に再び戻す
    if (currentTurn === 1) {
        currentTurn = 2;
    } else {
        currentTurn = 1;
    }
    
    // 自分に打てる場所があるかをもう一度調べる
    movable = getMovableCells(currentTurn);

    if (movable.length > 0) {
        // 自分は打てるので、連続して自分のターンを進める
        updateUI();
        return;
    }

    // ── 自分も相手もどちらも置ける場所がない場合 ──
    // お互いに打つ手がなくなったので、ゲーム終了の関数を呼び出す
    endGame();
}

/**
 * ゲームが終了したときに、石の数を数えて結果をログに書き込む関数
 */
function endGame() {
    let blackCount = 0;
    let whiteCount = 0;

    // 盤面の全64マスをスキャンして、黒と白の石を1個ずつカウントする
    for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
            if (board[y][x] === 1) {
                blackCount++;
            }
            if (board[y][x] === 2) {
                whiteCount++;
            }
        }
    }

    // 結果の文章（文字列）を組み立てる
    let resultMessage = "🎉 ゲーム終了！ 【黒: " + blackCount + "枚 / 白: " + whiteCount + "枚】 ── ";
    
    if (blackCount > whiteCount) {
        resultMessage = resultMessage + "黒（●）の勝ちです！";
    } else if (whiteCount > blackCount) {
        resultMessage = resultMessage + "白（○）の勝ちです！";
    } else {
        resultMessage = resultMessage + "引き分けです！";
    }

    // 【重要】組み立てた結果をupdateUIを使って <div id="log"> にしっかり書き込む
    updateUI(resultMessage);
    
    // ターンを表示していた部分の文字を「ゲーム終了」にする
    const turnEl = document.getElementById("turn");
    if (turnEl !== null) {
        turnEl.textContent = "ゲーム終了";
    }

    // もしオートモードが動いていたら完全に停止させる
    stopAutoMode();
}


// ==========================================
// 5. オートモード（自動プレイ）のコントロール
// ==========================================

/**
 * オートモードがONのとき、0.3秒おきに自動で実行されるAI（ランダム打ち）の関数
 */
async function runAutoMode() {
    // 演出中なら、この回の自動処理はスキップする
    if (isAnimating === true) {
        return;
    }

    // すでにゲームが終了している状態なら、オートモードのタイマーを止めて終了する
    const turnEl = document.getElementById("turn");
    if (turnEl !== null && turnEl.textContent === "ゲーム終了") {
        stopAutoMode();
        return;
    }

    // 現在のプレイヤーが置ける場所のリストを取得する
    let movable = getMovableCells(currentTurn);
    
    if (movable.length > 0) {
        // 置ける場所リストの中から、ランダムで1つ番号（インデックス）を選ぶ
        let randomIndex = Math.floor(Math.random() * movable.length);
        let targetCell = movable[randomIndex];
        
        // 選んだマスを自動的にクリックしたことにして、石を置く処理を実行する
        await handleCellClick(targetCell.x, targetCell.y);
    }
}

/**
 * オートモードのタイマーを開始する関数
 */
function startAutoMode() {
    // すでにタイマーが動いているなら、二重に起動しないようにする
    if (autoModeInterval !== null) {
        return;
    }
    // 300ミリ秒（0.3秒）間隔で、runAutoModeという関数をずっと実行し続けるタイマーをセット
    autoModeInterval = setInterval(runAutoMode, 300);
}

/**
 * オートモードのタイマーを完全に停止させる関数
 */
function stopAutoMode() {
    if (autoModeInterval !== null) {
        // 動いているタイマーの機械を止める
        clearInterval(autoModeInterval);
        // 変数を空っぽ（null）に戻す
        autoModeInterval = null;
    }
}


// ==========================================
// 6. ページが読み込まれた時にイベントを登録する
// ==========================================

window.onload = function() {
    // ゲームの初期配置とCanvasの準備を行う
    initialize();
    // 最初のプレイヤーの「置ける場所ガイド」を表示する
    updateUI();

    // HTMLからチェックボックスの要素を読み込む
    const checkboxEl = document.getElementById("checkbox");

    // ── オセロ盤（Canvas）がクリックされたときのイベント登録 ──
    boardObj.addEventListener("click", function(event) {
        // もしオートモードのチェックボックスにチェックが入っているなら、手動のクリックは無視する
        if (checkboxEl !== null && checkboxEl.checked === true) {
            return;
        }

        // クリックされた位置が、Canvasの中の左上から数えて何ピクセルの位置かを取得する
        const rect = boardObj.getBoundingClientRect();
        const clientX = event.clientX - rect.left;
        const clientY = event.clientY - rect.top;

        // ピクセル座標を、マス目のインデックス（0〜7）に変換する
        const x = Math.floor(clientX / CELL_PX);
        const y = Math.floor(clientY / CELL_PX);

        // クリックした場所が、ちゃんと盤面（0〜7マス）の中身であれば、石を置くメイン関数を実行する
        if (x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE) {
            handleCellClick(x, y);
        }
    });

    // ── チェックボックスが切り替えられたときのイベント登録 ──
    if (checkboxEl !== null) {
        checkboxEl.addEventListener("change", function() {
            if (checkboxEl.checked === true) {
                // チェックが入ったらオートモード起動
                startAutoMode();
            } else {
                // チェックが外れたらオートモード停止
                stopAutoMode();
            }
        });

        // ページを開いた瞬間に、最初からチェックボックスにチェックが入っていた場合の対策
        if (checkboxEl.checked === true) {
            startAutoMode();
        }
    }
};