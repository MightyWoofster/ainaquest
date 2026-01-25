/* ʻĀinaQuest Hot-seat MVP
   - Static HTML/CSS/JS (GitHub Pages friendly)
   - Implements: 3 rounds, deal 9, secret choose, Huli reveal, pass hands, basic scoring, invasive penalty
*/

const CARD_BACK = "assets/backs/back.png";

const WAIWAI_COLOR_BONUS = {
  blue: 5,
  orange: 10,
  green: 15,
  pink: 20
};

const SCREENS = {
  setup: document.getElementById('screen-setup'),
  gate: document.getElementById('screen-gate'),
  choose: document.getElementById('screen-choose'),
  huli: document.getElementById('screen-huli'),
  roundscore: document.getElementById('screen-roundscore'),
  final: document.getElementById('screen-final'),
};

const ui = {
  playerCount: document.getElementById('player-count'),
  playerInputs: document.getElementById('player-inputs'),
  btnStart: document.getElementById('btn-start'),
  btnReset: document.getElementById('btn-reset'),

  gateTitle: document.getElementById('gate-title'),
  gateSubtitle: document.getElementById('gate-subtitle'),
  btnReveal: document.getElementById('btn-reveal'),

  chooseTitle: document.getElementById('choose-title'),
  chooseSubtitle: document.getElementById('choose-subtitle'),
  hand: document.getElementById('hand'),
  btnPlant: document.getElementById('btn-plant'),
  btnCancel: document.getElementById('btn-cancel'),
  uiRound: document.getElementById('ui-round'),
  uiTurn: document.getElementById('ui-turn'),

  huliGrid: document.getElementById('huli-grid'),
  btnNextTurn: document.getElementById('btn-next-turn'),

  roundscore: document.getElementById('roundscore'),
  btnNextRound: document.getElementById('btn-next-round'),

  finalscore: document.getElementById('finalscore'),
  btnPlayAgain: document.getElementById('btn-play-again'),

  status: document.getElementById('status'),
  decksize: document.getElementById('decksize'),
};

let CARDS = [];
let GAME = null;
let selectedInstanceId = null;
let CARDS_LOADED = false;

// ---------- helpers ----------
function showScreen(name){
  Object.entries(SCREENS).forEach(([k, el]) => el.classList.toggle('hidden', k !== name));
}

function setStatus(msg){ ui.status.textContent = msg; }

function shuffle(arr){
  for(let i=arr.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cardTypeClass(card){
  if(!card) return 'type-native';
  if(card.type === 'invasive') return 'type-invasive';
  if(card.type === 'canoe') return 'type-canoe';
  if(card.type === 'resource') return 'type-resource';
  return 'type-native';
}

function makeDefaultNames(n){
  return Array.from({length:n}, (_,i)=>`Player ${i+1}`);
}

// ---------- loading ----------
async function loadCards(){
  const res = await fetch('./data/cards.json', { cache: 'no-store' });
  if(!res.ok) throw new Error(`Failed to load cards.json (${res.status})`);
  const data = await res.json();
  if(!Array.isArray(data)) throw new Error('cards.json must be an array');
  CARDS = data;
  CARDS_LOADED = true;
}

function buildDeck(){
  const deck = [];
  for(const c of CARDS){
    const count = Number(c.count ?? 1);
    for(let i=0; i<count; i++){
      deck.push({ ...c, instanceId: `${c.id}__${i}` });
    }
  }
  shuffle(deck);
  return deck;
}

// ---------- UI setup ----------
function renderPlayerInputs(){
  const n = parseInt(ui.playerCount.value, 10);
  const existing = Array.from(ui.playerInputs.querySelectorAll('input')).map(i => i.value);
  const names = existing.length ? existing : makeDefaultNames(n);

  ui.playerInputs.innerHTML = '';
  for(let i=0; i<n; i++){
    const row = document.createElement('div');
    row.className = 'player-row';
    row.innerHTML = `
      <span class="badge">P${i+1}</span>
      <input type="text" value="${names[i] ?? `Player ${i+1}`}" data-idx="${i}" />
    `;
    ui.playerInputs.appendChild(row);
  }
}

function getPlayerNames(){
  const inputs = Array.from(ui.playerInputs.querySelectorAll('input'));
  return inputs.map(i => i.value.trim()).filter(Boolean);
}

// ---------- game state ----------
function newGame(names){
  const deck = buildDeck();
  ui.decksize.textContent = String(deck.length);

  return {
    names,
    round: 1,
    turn: 1,                 // 1..9
    currentPicker: 0,         // who is choosing now
    deck,
    hands: names.map(() => []),
    plantedFaceDown: names.map(() => null),
    tableaus: names.map(() => []),
    invasives: names.map(() => []),   // persists across rounds
    roundScores: names.map(() => [0,0,0]), // store numeric totals per round
    huliRevealed: false,
  };
}

function dealRound(){
  const n = GAME.names.length;
  const CARDS_PER_PLAYER = 9;

  GAME.hands = GAME.names.map(() => []);
  GAME.tableaus = GAME.names.map(() => []);
  GAME.plantedFaceDown = GAME.names.map(() => null);

  const need = n * CARDS_PER_PLAYER;
  if(GAME.deck.length < need){
    GAME.deck = buildDeck();
  }

  for(let p=0; p<n; p++){
    for(let k=0; k<CARDS_PER_PLAYER; k++){
      const card = GAME.deck.pop();
      GAME.hands[p].push(card);
    }
  }
  ui.decksize.textContent = String(GAME.deck.length);

  GAME.turn = 1;
  GAME.currentPicker = 0;
  setStatus(`Round ${GAME.round}: dealt ${CARDS_PER_PLAYER} cards each.`);
}

function currentPlayerName(){
  return GAME.names[GAME.currentPicker];
}

// ---------- screens ----------
function showGate(){
  showScreen('gate');
  ui.gateTitle.textContent = `Pass to ${currentPlayerName()}`;
  ui.gateSubtitle.textContent = `Tap “Reveal my hand” when ${currentPlayerName()} is ready.`;
  ui.btnPlant.disabled = true;
  setStatus(`Waiting for ${currentPlayerName()} to choose a card.`);
}

function renderHand(){
  if(!GAME) return;

  showScreen('choose');
  ui.uiRound.textContent = String(GAME.round);
  ui.uiTurn.textContent = String(GAME.turn);

  ui.chooseTitle.textContent = `${currentPlayerName()}: choose a card to plant`;
  ui.chooseSubtitle.textContent = `Pick 1 card. It will be planted face-down.`;

  selectedInstanceId = null;
  ui.btnPlant.disabled = true;
  ui.hand.innerHTML = '';

  const hand = GAME.hands[GAME.currentPicker] || [];
  for(const card of hand){
    if(!card) continue;

    const tile = document.createElement('div');
    tile.className = `cardtile ${cardTypeClass(card)}`;
    tile.dataset.instanceId = card.instanceId;

    // accept either "front" or older "image"
    const imgSrc = card.front ?? card.image ?? '';

    tile.innerHTML = `
      <div class="cardpoints">${Number(card.points ?? 0)}</div>
      <img class="cardimg" alt="${card.name}" src="${imgSrc}">
      <div class="cardmeta">
        <div class="cardname">${card.name}</div>
        <div class="cardtype">${card.type}</div>
      </div>
    `;

    tile.addEventListener('click', () => {
      selectedInstanceId = card.instanceId;
      ui.btnPlant.disabled = false;
      Array.from(ui.hand.querySelectorAll('.cardtile')).forEach(el =>
        el.classList.toggle('selected', el.dataset.instanceId === selectedInstanceId)
      );
    });

    ui.hand.appendChild(tile);
  }
}

function plantSelected(){
  if(!GAME || !selectedInstanceId) return;

  const p = GAME.currentPicker;
  const hand = GAME.hands[p] || [];
  const idx = hand.findIndex(c => c && c.instanceId === selectedInstanceId);
  if(idx < 0) return;

  const [picked] = hand.splice(idx, 1);
  GAME.plantedFaceDown[p] = picked;

  setStatus(`${GAME.names[p]} planted a card (face-down).`);
  selectedInstanceId = null;

  if(p < GAME.names.length - 1){
    GAME.currentPicker++;
    showGate();
  } else {
    GAME.huliRevealed = false;
    showHuli();
  }
}

function showHuli(){
  showScreen('huli');
  ui.huliGrid.innerHTML = '';

  const isRevealed = !!GAME.huliRevealed;
  ui.btnNextTurn.textContent = isRevealed ? 'Continue' : 'Huli! Reveal';

  for(let p=0; p<GAME.names.length; p++){
    const card = GAME.plantedFaceDown[p];
    if(!card) continue;

    const imgSrc = isRevealed ? (card.front ?? card.image ?? '') : CARD_BACK;
    const showName = isRevealed ? card.name : 'Face-down card';
    const showType = isRevealed ? card.type : '—';
    const showPoints = isRevealed ? Number(card.points ?? 0) : '—';

    const box = document.createElement('div');
    box.className = 'revealbox';

    box.innerHTML = `
      <div class="revealhead">
        <div class="revealplayer">${GAME.names[p]}</div>
        <div class="smallpill">Turn ${GAME.turn}</div>
      </div>
      <div style="padding:10px">
        <div class="cardtile ${isRevealed ? cardTypeClass(card) : ''}" style="cursor:default">
          <div class="cardpoints">${showPoints}</div>
          <img class="cardimg" alt="${showName}" src="${imgSrc}">
          <div class="cardmeta">
            <div class="cardname">${showName}</div>
            <div class="cardtype">${showType}</div>
          </div>
        </div>
      </div>
    `;

    ui.huliGrid.appendChild(box);
  }

  setStatus(isRevealed
    ? 'Huli! Revealed planted cards. Ready to pass hands.'
    : 'Cards are face-down. Press Huli! to reveal.'
  );
}

// ---------- turn progression ----------
function rotateHandsLeft(){
  const n = GAME.names.length;
  const newHands = Array.from({length:n}, () => []);
  for(let p=0; p<n; p++){
    const to = (p + 1) % n;
    newHands[to] = GAME.hands[p];
  }
  GAME.hands = newHands;
}

function commitTurnAndContinue(){
  // add planted to tableaus, track invasives
  for(let p=0; p<GAME.names.length; p++){
    const card = GAME.plantedFaceDown[p];
    if(!card) continue;

    GAME.tableaus[p].push(card);
    if(card.type === 'invasive') GAME.invasives[p].push(card);
    GAME.plantedFaceDown[p] = null;
  }

  rotateHandsLeft();

  if(GAME.turn < 9){
    GAME.turn++;
    GAME.currentPicker = 0;
    showGate();
  } else {
    endRound();
  }
}

// ---------- scoring ----------
function computeIconTriplesBonus(tableau){
  const counts = {};

  for (const c of tableau) {
    if (!c) continue;
    if (c.type === "invasive") continue;
    if (c.type === "resource") continue;
    if (!Array.isArray(c.iconColors)) continue;

    // multi-color counts for ALL listed colors
    for (const col of c.iconColors) {
      counts[col] = (counts[col] || 0) + 1;
    }
  }

  let bonus = 0;
  const triplesByColor = {};

  for (const col in counts) {
    const triples = Math.floor(counts[col] / 3);
    if (triples > 0) {
      triplesByColor[col] = triples;
      bonus += triples * (WAIWAI_COLOR_BONUS[col] || 0);
    }
  }

  return { bonus, triplesByColor, counts };
}

function basicRoundScore(p){
  let base = 0;

  for (const c of GAME.tableaus[p]) {
    if (!c) continue;
    if (c.type === "invasive") continue;
    if (c.type === "resource") continue;
    base += Number(c.points ?? 0);
  }

  const icon = computeIconTriplesBonus(GAME.tableaus[p]);

  return {
    base,
    iconBonus: icon.bonus,
    triplesByColor: icon.triplesByColor,
    total: base + icon.bonus
  };
}

function endRound(){
  showScreen('roundscore');
  ui.roundscore.innerHTML = '';

  for(let p=0; p<GAME.names.length; p++){
    const line = document.createElement('div');
    line.className = 'scoreline';

    const invCount = GAME.invasives[p].length;
    const s = basicRoundScore(p);

    // store numeric total for this round (0-based round index)
    GAME.roundScores[p][GAME.round - 1] = s.total;

    const tripleText = s.triplesByColor && Object.keys(s.triplesByColor).length
      ? Object.entries(s.triplesByColor).map(([c, t]) => `${c}×${t}`).join(", ")
      : "none";

    line.innerHTML = `
      <b>${GAME.names[p]}</b>
      <div class="kv">
        <span>Base: <b>${s.base}</b></span>
        <span>Triples: <b>${tripleText}</b></span>
        <span>Bonus: <b>${s.iconBonus}</b></span>
        <span>Round ${GAME.round}: <b>${s.total}</b></span>
        <span>Invasives: <b>${invCount}</b></span>
      </div>
    `;

    ui.roundscore.appendChild(line);
  }

  setStatus(`Round ${GAME.round} complete.`);
}

function startNextRound(){
  if(GAME.round < 3){
    GAME.round++;
    dealRound();
    showGate();
  } else {
    showFinal();
  }
}

function showFinal(){
  showScreen('final');

  const n = GAME.names.length;
  const totals = [];
  const invCounts = GAME.invasives.map(arr => arr.length);
  const maxInv = Math.max(...invCounts);
  const penalized = invCounts.map(c => c === maxInv && maxInv > 0);

  for(let p=0; p<n; p++){
    const sumRounds = GAME.roundScores[p].reduce((a,b)=>a+Number(b||0), 0);
    const penalty = penalized[p] ? 20 : 0;
    totals.push({ p, sumRounds, penalty, final: sumRounds - penalty, inv: invCounts[p] });
  }

  totals.sort((a,b) => b.final - a.final);

  ui.finalscore.innerHTML = '';
  for(const t of totals){
    const line = document.createElement('div');
    line.className = 'scoreline';
    line.innerHTML = `
      <b>${GAME.names[t.p]}</b>
      <div class="kv">
        <span>Rounds total: <b>${t.sumRounds}</b></span>
        <span>Invasives: <b>${t.inv}</b></span>
        <span>Penalty: <b>${t.penalty ? '-' + t.penalty : '0'}</b></span>
        <span>Final: <b>${t.final}</b></span>
      </div>
    `;
    ui.finalscore.appendChild(line);
  }

  setStatus('Game over.');
}

function resetAll(){
  GAME = null;
  showScreen('setup');
  setStatus('Ready.');
}

// ---------- events ----------
function wireUI(){
  ui.playerCount.addEventListener('change', renderPlayerInputs);

  ui.btnStart.addEventListener('click', () => {
    if(!CARDS_LOADED){
      alert('Cards are still loading—try again in a moment.');
      return;
    }
    const names = getPlayerNames();
    const n = parseInt(ui.playerCount.value, 10);
    if(names.length < n){
      alert('Please fill in all player names.');
      return;
    }
    GAME = newGame(names.slice(0,n));
    dealRound();
    showGate();
  });

  ui.btnReset.addEventListener('click', resetAll);

  ui.btnReveal.addEventListener('click', renderHand);
  ui.btnCancel.addEventListener('click', showGate);
  ui.btnPlant.addEventListener('click', plantSelected);

  ui.btnNextTurn.addEventListener('click', () => {
    if(!GAME) return;
    if(!GAME.huliRevealed){
      GAME.huliRevealed = true;
      showHuli();
    } else {
      commitTurnAndContinue();
    }
  });

  ui.btnNextRound.addEventListener('click', startNextRound);

  ui.btnPlayAgain.addEventListener('click', () => {
    renderPlayerInputs();
    resetAll();
  });
}

// ---------- init ----------
(async function init(){
  renderPlayerInputs();
  wireUI();

  // Prevent “start before cards load”
  ui.btnStart.disabled = true;

  try{
    await loadCards();
    const deck = buildDeck();
    ui.decksize.textContent = String(deck.length);
    CARDS_LOADED = true;
    ui.btnStart.disabled = false;
    setStatus('Loaded cards. Configure players to start.');
  } catch(err){
    console.error(err);
    setStatus('ERROR: could not load data/cards.json. Check path + JSON validity.');
    alert('Could not load cards.json. Open Console for details.');
  }
})();
