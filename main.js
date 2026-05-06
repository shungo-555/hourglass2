const timerDisplay = document.getElementById('timer-display');
const pieChart = document.getElementById('pie-chart');
const resetBtn = document.getElementById('reset-btn');
const startStopBtn = document.getElementById('start-stop-btn');
const customBtn = document.getElementById('custom-btn');
const presetBtns = document.querySelectorAll('.preset-btn:not(#custom-btn)');
const canvas = document.getElementById('animation-canvas');
const ctx = canvas.getContext('2d');
const animalContainer = document.getElementById('animal-container');

// Modal Elements
const pickerModal = document.getElementById('picker-modal');
// Unused scroll element references removed

// const scrollMins = document.getElementById('scroll-mins');
// const scrollSecs = document.getElementById('scroll-secs');
// Digit Picker State
let inputIndex = 0;
let currentDigits = [0, 0, 0, 0];
let digitBoxes = [];

const pickerOk = document.getElementById('picker-ok');
const pickerCancel = document.getElementById('picker-cancel');

let timeLeft = 0;
let totalTime = 0;
let timerId = null;
let particles = [];
let animationId = null;
let audioCtx = null;
let isRunning = false;
let finishSoundInterval = null; // ループ音用タイマー

const ANIMALS = [
    { emoji: '🦒' }, { emoji: '🦁' }, { emoji: '🐘' }, { emoji: '🐰' }, 
    { emoji: '🐻' }, { emoji: '🐢' }, { emoji: '🐱' }, { emoji: '🐶' }, 
    { emoji: '🦋' }, { emoji: '🐸' }, { emoji: '🐧' }, { emoji: '🐒' },
    { emoji: '🐹' }, { emoji: '🐼' }, { emoji: '🐨' }, { emoji: '🐥' }, 
    { emoji: '🐷' }, { emoji: '🦊' }, { emoji: '🦄' }
];

function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const minutes = parseInt(btn.dataset.time);
            setTimer(minutes * 60);
            startTimer();
        });
    });

    customBtn.addEventListener('click', () => {
        console.log('Custom button clicked');
        // ピッカーを開く際に入力状態をリセット
        inputIndex = 0;
        currentDigits = [0, 0, 0, 0];
        updatePickerUI();
        pickerModal.style.display = 'flex';
    });

    startStopBtn.addEventListener('click', () => {
        console.log('Start/Stop button clicked');
        if (isRunning) stopTimer();
        else startTimer();
    });

    resetBtn.addEventListener('click', () => {
        console.log('Reset button clicked');
        resetTimer();
    });

    // テンキーの初期化
    digitBoxes = [
        document.getElementById('db-0'),
        document.getElementById('db-1'),
        document.getElementById('db-2'),
        document.getElementById('db-3')
    ];
    
    const keyBtns = document.querySelectorAll('.key-btn[data-val]');
    const keyClear = document.getElementById('key-clear');
    const keyBack = document.getElementById('key-back');

    function updateKeypadStatus() {
        keyBtns.forEach(btn => {
            const val = parseInt(btn.dataset.val);
            // 秒10位（インデックス2）のときは6以上を無効化
            if (inputIndex === 2 && val >= 6) {
                btn.disabled = true;
            } else {
                btn.disabled = false;
            }
        });
    }

    function updatePickerUI() {
        digitBoxes.forEach((box, i) => {
            box.textContent = currentDigits[i];
            box.classList.toggle('active', i === inputIndex);
        });
        updateKeypadStatus();
    }

    keyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const val = parseInt(btn.dataset.val);
            if (inputIndex < 4) {
                currentDigits[inputIndex] = val;
                inputIndex = Math.min(inputIndex + 1, 4);
                updatePickerUI();
            }
        });
    });

    keyClear.addEventListener('click', () => {
        inputIndex = 0;
        currentDigits = [0, 0, 0, 0];
        updatePickerUI();
    });

    keyBack.addEventListener('click', () => {
        if (inputIndex > 0) {
            // 現在のフォーカスが4（全入力済み）なら、3に戻して消す
            // それ以外なら一つ戻って消す
            inputIndex--;
            currentDigits[inputIndex] = 0;
            updatePickerUI();
        }
    });

    // ピッカー OK / Cancel
    pickerOk.addEventListener('click', () => {
        console.log('Picker OK clicked');
        const mins = currentDigits[0] * 10 + currentDigits[1];
        const secs = currentDigits[2] * 10 + currentDigits[3];
        const totalSecs = mins * 60 + secs;
        if (totalSecs > 0) {
            setTimer(totalSecs);
            startTimer();
        }
        hidePicker();
    });
    pickerCancel.addEventListener('click', hidePicker);

    // 動物の出現ループ
    animalLoop();
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// --- タイムピッカー (ドラムロール風) ---

function initPicker() {
    // もはや使用しないので空関数
}

// generatePickerItems 削除（使用しない）

// updateActiveItem 削除（使用しない）

// getPickerValue 削除（使用しない）

function showPicker() {
    pickerModal.style.display = 'flex';
}

function hidePicker() {
    pickerModal.style.display = 'none';
}

// --- タイマー機能 ---

function setTimer(seconds) {
    resetTimer();
    totalTime = seconds;
    timeLeft = seconds;
    updateDisplay();
}

function startTimer() {
    if (isRunning || timeLeft <= 0) return;
    isRunning = true;
    startStopBtn.textContent = 'ストップ';
    startStopBtn.classList.add('running');
    initAudio();
    // タイマー開始時に終了音ループが走っていたら止める
    if (finishSoundInterval) {
        clearInterval(finishSoundInterval);
        finishSoundInterval = null;
    }
    timerId = setInterval(() => {
        timeLeft--;
        updateDisplay();
        if (timeLeft <= 0) finishTimer();
    }, 1000);
}

function stopTimer() {
    isRunning = false;
    startStopBtn.textContent = 'スタート';
    startStopBtn.classList.remove('running');
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
    }
    // ユーザーが手動で止めたときは終了音ループを止める
    if (finishSoundInterval) {
        clearInterval(finishSoundInterval);
        finishSoundInterval = null;
    }
}

function resetTimer() {
    stopTimer();
    stopAnimation();
    timeLeft = 0;
    totalTime = 0;
    updateDisplay();
    // リセット時にも終了音ループが走っていたら止める
    if (finishSoundInterval) {
        clearInterval(finishSoundInterval);
        finishSoundInterval = null;
    }
}

function updateDisplay() {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    
    if (totalTime > 0) {
        const percentage = (timeLeft / totalTime) * 360;
        // 12時から時計回りに「消えていく」表現
        pieChart.style.background = `conic-gradient(transparent ${360 - percentage}deg, var(--primary-color) 0deg)`;
    } else {
        pieChart.style.background = `conic-gradient(transparent 0deg, var(--primary-color) 0deg)`;
    }
}

function finishTimer() {
    // タイマー停止（finishTimer 内で stopTimer が呼ばれるのを防ぐ）
    isRunning = false;
    startStopBtn.textContent = 'スタート';
    startStopBtn.classList.remove('running');
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
    }
    // 終了音をループ再生開始
    playFinishSound();
    finishSoundInterval = setInterval(() => {
        playFinishSound();
    }, 2000); // 2秒ごとにビープ
    startRandomAnimation();
}

// --- 音声 ---

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playFinishSound() {
    if (!audioCtx) return;
    const playBeep = (time, freq) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.5);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(time);
        osc.stop(time + 0.5);
    };
    const now = audioCtx.currentTime;
    playBeep(now, 880);
    playBeep(now + 0.3, 880);
    playBeep(now + 0.6, 880);
}

// --- アニマルアニメーション ---

function animalLoop() {
    const nextDelay = 20000 + Math.random() * 20000;
    setTimeout(() => {
        if (isRunning) showAnimals();
        animalLoop();
    }, nextDelay);
}

function showAnimals() {
    const count = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < count; i++) {
        setTimeout(() => createAnimal(), i * 800);
    }
}

function createAnimal() {
    const animalData = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const animalEl = document.createElement('div');
    animalEl.className = 'animal';
    animalEl.textContent = animalData.emoji;
    
    const side = Math.random() > 0.5 ? 'left' : 'right';
    const top = 10 + Math.random() * 70;
    animalEl.style.top = `${top}%`;
    
    // ランダムなサイズ（6rem〜12rem）を設定
    const size = 6 + Math.random() * 6;
    animalEl.style.fontSize = `${size}rem`;
    
    if (side === 'left') {
        animalEl.style.left = '-200px';
        animalContainer.appendChild(animalEl);
        const duration = 7000 + Math.random() * 5000;
        animalEl.animate([
            { transform: 'translateX(0px) rotate(0deg)' },
            { transform: `translateX(${window.innerWidth + 400}px) rotate(20deg)` }
        ], { duration, easing: 'linear' }).onfinish = () => animalEl.remove();
    } else {
        animalEl.style.right = '-200px';
        animalContainer.appendChild(animalEl);
        const duration = 7000 + Math.random() * 5000;
        animalEl.animate([
            { transform: 'translateX(0px) rotate(0deg)' },
            { transform: `translateX(-${window.innerWidth + 400}px) rotate(-20deg)` }
        ], { duration, easing: 'linear' }).onfinish = () => animalEl.remove();
    }
}

// --- パーティクルアニメーション ---

class Particle {
    constructor(type) {
        this.type = type;
        this.reset();
    }
    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.size = Math.random() * 10 + 5;
        this.color = `hsl(${Math.random() * 360}, 70%, 60%)`;
        this.life = 1;
        this.decay = Math.random() * 0.02 + 0.005;

        if (this.type === 'balloon') {
            this.y = canvas.height + 50;
            this.vy = -(Math.random() * 2 + 1);
            this.vx = Math.sin(this.y * 0.01) * 2;
        } else if (this.type === 'snow') {
            this.y = -20;
            this.vy = Math.random() * 2 + 1;
            this.color = 'white';
            this.size = Math.random() * 5 + 2;
        } else if (this.type === 'firework') {
            this.x = canvas.width / 2;
            this.y = canvas.height / 2;
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 12 + 6;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
        } else if (this.type === 'petal') {
            this.y = -20;
            this.vy = Math.random() * 2 + 1;
            this.color = '#FFB7C5';
            this.size = Math.random() * 8 + 4;
        } else if (this.type === 'star') {
            this.color = '#FFF176';
            this.size = Math.random() * 6 + 2;
        } else if (this.type === 'bubble') {
            this.y = canvas.height + 20;
            this.vy = -(Math.random() * 3 + 1);
            this.color = 'rgba(255, 255, 255, 0.4)';
            this.size = Math.random() * 20 + 10;
        } else if (this.type === 'confetti') {
            this.y = -20;
            this.vy = Math.random() * 5 + 3;
            this.width = Math.random() * 10 + 5;
            this.height = Math.random() * 15 + 5;
            this.rotation = Math.random() * 360;
            this.rotationSpeed = (Math.random() - 0.5) * 15;
        }
    }
    update() {
        if (this.type === 'balloon') {
            this.y += this.vy;
            this.x += Math.sin(this.y * 0.05) * 2;
            if (this.y < -100) this.reset();
        } else if (this.type === 'snow' || this.type === 'petal') {
            this.y += this.vy;
            this.x += Math.sin(this.y * 0.02) * 2;
            if (this.y > canvas.height + 20) this.reset();
        } else if (this.type === 'firework') {
            this.x += this.vx;
            this.y += this.vy;
            this.vy += 0.15;
            this.life -= this.decay;
            if (this.life <= 0) this.reset();
        } else if (this.type === 'star') {
            this.life -= 0.01;
            if (this.life <= 0) this.reset();
        } else if (this.type === 'bubble') {
            this.y += this.vy;
            this.x += Math.sin(this.y * 0.1) * 3;
            if (this.y < -100) this.reset();
        } else if (this.type === 'confetti') {
            this.y += this.vy;
            this.rotation += this.rotationSpeed;
            if (this.y > canvas.height + 20) this.reset();
        }
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        if (this.type === 'balloon') {
            ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(this.x, this.y + this.size); ctx.lineTo(this.x, this.y + this.size + 15);
            ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.stroke();
        } else if (this.type === 'snow' || this.type === 'star') {
            ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        } else if (this.type === 'firework') {
            ctx.beginPath(); ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2); ctx.fill();
        } else if (this.type === 'petal') {
            ctx.translate(this.x, this.y); ctx.rotate(this.y * 0.1);
            ctx.beginPath(); ctx.ellipse(0, 0, this.size, this.size / 2, 0, 0, Math.PI * 2); ctx.fill();
        } else if (this.type === 'bubble') {
            ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = this.color; ctx.fill();
        } else if (this.type === 'confetti') {
            ctx.translate(this.x, this.y); ctx.rotate(this.rotation * Math.PI / 180);
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        }
        ctx.restore();
    }
}

function startRandomAnimation() {
    const types = ['balloon', 'snow', 'firework', 'petal', 'star', 'bubble', 'confetti'];
    const selectedType = types[Math.floor(Math.random() * types.length)];
    particles = [];
    for (let i = 0; i < 120; i++) particles.push(new Particle(selectedType));
    animate();
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    animationId = requestAnimationFrame(animate);
}

function stopAnimation() {
    if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

window.addEventListener('DOMContentLoaded', init);
