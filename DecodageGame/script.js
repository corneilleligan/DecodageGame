// ── State ─────────────────────────────────────────
const CONVERSIONS = [
  { id:'bin-dec', name:'Binaire → Décimal',      from:'binary',  to:'decimal', hint:'décimal'    },
  { id:'dec-bin', name:'Décimal → Binaire',      from:'decimal', to:'binary',  hint:'binaire'    },
  { id:'hex-dec', name:'Hexadécimal → Décimal',  from:'hex',     to:'decimal', hint:'décimal'    },
  { id:'dec-hex', name:'Décimal → Hexadécimal',  from:'decimal', to:'hex',     hint:'hexadécimal'},
  { id:'hex-bin', name:'Hexadécimal → Binaire',  from:'hex',     to:'binary',  hint:'binaire'    },
  { id:'bin-hex', name:'Binaire → Hexadécimal',  from:'binary',  to:'hex',     hint:'hexadécimal'},
];

const DIFF = {
  easy:   { min:0, max:31,   time:45, bonus:50,  convIdx:[0,1] },
  medium: { min:0, max:255,  time:60, bonus:100, convIdx:[0,1,2,3] },
  hard:   { min:0, max:4095, time:90, bonus:200, convIdx:[0,1,2,3,4,5] },
};

const TIME_MULT = { 'bin-hex':1.5, 'hex-bin':1.3, 'dec-bin':1.2 };

let state = {
  screen: 'menu',
  difficulty: 'medium',
  totalQ: 10,
  qNum: 1,
  score: 0,
  bestScore: parseInt(localStorage.getItem('decode-best') || '0'),
  challenge: null,
  timeLeft: 60,
  answers: [],
  feedback: false,
  timerInterval: null,
};

function fmt(n, base) {
  if (base === 'binary') return n.toString(2);
  if (base === 'hex')    return n.toString(16).toUpperCase();
  return n.toString(10);
}

function normalize(s) { return s.trim().toUpperCase().replace(/^0+(?=\S)/,''); }

function genChallenge(diff, qNum) {
  const d = DIFF[diff];
  const n = Math.floor(Math.random() * (d.max - d.min + 1)) + d.min;
  const idx = d.convIdx[qNum % d.convIdx.length];
  const conv = CONVERSIONS[idx];
  const timeLimit = Math.ceil(d.time * (TIME_MULT[conv.id] || 1));
  return { n, conv, display: fmt(n, conv.from), answer: fmt(n, conv.to), timeLimit };
}

// ── DOM refs ──────────────────────────────────────
const screens = {
  menu:    document.getElementById('screen-menu'),
  playing: document.getElementById('screen-playing'),
  results: document.getElementById('screen-results'),
};

const $ = id => document.getElementById(id);

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  state.screen = name;
}

// ── Menu ──────────────────────────────────────────
$('bestScoreDisplay').textContent = state.bestScore;

$('startBtn').addEventListener('click', () => {
  state.difficulty = $('difficultySelect').value;
  state.totalQ     = parseInt($('totalQSelect').value);
  startGame();
});

function startGame() {
  state.qNum    = 1;
  state.score   = 0;
  state.answers = [];
  state.feedback = false;
  loadChallenge();
  showScreen('playing');
  $('answerInput').focus();
}

function loadChallenge() {
  clearInterval(state.timerInterval);
  const ch = genChallenge(state.difficulty, state.qNum - 1);
  state.challenge = ch;
  state.timeLeft  = ch.timeLimit;
  state.feedback  = false;

  // Update UI
  $('qProgress').textContent    = `${state.qNum}/${state.totalQ}`;
  $('scoreDisplay').textContent = state.score;
  $('progressFill').style.width = `${((state.qNum-1)/state.totalQ)*100}%`;
  $('conversionBadge').textContent = ch.conv.name;
  $('numberDisplay').textContent   = ch.display;
  $('numberHint').textContent      = `→ convertir en ${ch.conv.hint}`;
  $('feedbackBox').style.display   = 'none';
  $('answerInput').value           = '';
  $('answerInput').className       = 'answer-input';
  $('answerInput').disabled        = false;
  $('submitBtn').disabled          = true;
  $('timerPill').className         = 'hud-pill timer';
  updateTimer();
  startTimer();
  setTimeout(() => $('answerInput').focus(), 60);
}

function updateTimer() {
  $('timerDisplay').textContent = state.timeLeft + 's';
  const danger = state.timeLeft <= 10;
  $('timerPill').className = 'hud-pill timer' + (danger ? ' danger' : '');
}

function startTimer() {
  state.timerInterval = setInterval(() => {
    if (state.feedback) return;
    state.timeLeft--;
    updateTimer();
    if (state.timeLeft <= 0) {
      clearInterval(state.timerInterval);
      handleResult(true);
    }
  }, 1000);
}

// ── Answer ────────────────────────────────────────
$('answerInput').addEventListener('input', e => {
  $('submitBtn').disabled = e.target.value.trim() === '';
});

$('answerInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !state.feedback && $('answerInput').value.trim()) {
    handleResult(false);
  }
});

$('submitBtn').addEventListener('click', () => {
  if (!state.feedback && $('answerInput').value.trim()) handleResult(false);
});

function handleResult(timedOut) {
  if (state.feedback) return;
  clearInterval(state.timerInterval);
  state.feedback = true;

  const ch      = state.challenge;
  const correct = normalize(ch.answer);
  const user    = normalize($('answerInput').value);
  const ok      = !timedOut && user === correct;

  const bonus = ok ? DIFF[state.difficulty].bonus + Math.floor(state.timeLeft * 3) : 0;
  state.score += bonus;

  state.answers.push({
    qNum: state.qNum,
    conv: ch.conv.name,
    display: ch.display,
    correct: ch.answer,
    userAnswer: timedOut ? '—' : ($('answerInput').value || '—'),
    ok, bonus
  });

  // Input visual
  $('answerInput').disabled  = true;
  $('answerInput').className = 'answer-input ' + (ok ? 'correct' : 'wrong');
  $('submitBtn').disabled    = true;
  $('scoreDisplay').textContent = state.score;

  // Feedback
  const fb = $('feedbackBox');
  fb.style.display = 'flex';
  if (ok) {
    fb.className = 'feedback-box correct';
    fb.innerHTML = `<span>✓</span><span>Correct — +${bonus} pts · ${state.timeLeft}s restantes</span>`;
  } else if (timedOut) {
    fb.className = 'feedback-box timeout';
    fb.innerHTML = `<span>⏱</span><span>Temps écoulé — Réponse : ${ch.answer}</span>`;
  } else {
    fb.className = 'feedback-box wrong';
    fb.innerHTML = `<span>✗</span><span>Incorrect — Réponse : ${ch.answer}</span>`;
  }

  setTimeout(() => {
    if (state.qNum < state.totalQ) {
      state.qNum++;
      loadChallenge();
    } else {
      showResults();
    }
  }, 1800);
}

// ── Results ───────────────────────────────────────
function showResults() {
  clearInterval(state.timerInterval);
  const correct = state.answers.filter(a => a.ok).length;
  const accuracy = Math.round((correct / state.totalQ) * 100);

  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    localStorage.setItem('decode-best', state.score);
    $('bestScoreDisplay').textContent = state.score;
  }

  $('resFinalScore').textContent = state.score;
  $('resAccuracy').textContent   = accuracy + '%';
  $('resCorrect').textContent    = `${correct}/${state.totalQ}`;

  $('recordBanner').style.display = state.score >= state.bestScore && correct > 0 ? 'flex' : 'none';

  // Build answers list
  const list = $('answersList');
  list.innerHTML = state.answers.map(a => `
    <div class="answer-item ${a.ok ? 'ok' : 'err'}">
      <div class="answer-item-top">
        <div style="display:flex;align-items:center;gap:.6rem;">
          <span class="answer-q">Q${a.qNum}</span>
          <span class="answer-conv">${a.conv}</span>
        </div>
        ${a.ok ? `<span class="answer-pts">+${a.bonus}</span>` : ''}
      </div>
      <div class="answer-number">${a.display}</div>
      <div class="answer-row ok" style="margin-bottom:.25rem;">
        <span class="answer-icon">✓</span>
        <span>${a.correct}</span>
      </div>
      <div class="answer-row ${a.ok ? 'ok' : 'err'}">
        <span class="answer-icon">${a.ok ? '✓' : '✗'}</span>
        <span>${a.userAnswer}</span>
        ${!a.ok ? `<span class="answer-correct-val">(${a.correct})</span>` : ''}
      </div>
    </div>
  `).join('');

  showScreen('results');
}

$('backMenuBtn').addEventListener('click', () => {
  clearInterval(state.timerInterval);
  showScreen('menu');
});