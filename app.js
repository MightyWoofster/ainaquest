/* ʻĀinaQuest Hot-seat MVP
   - Static HTML/CSS/JS (GitHub Pages friendly)
   - Implements: 3 rounds, deal 9, secret choose, Huli reveal, pass hands, basic scoring, invasive penalty
   - Resource effects + set bonuses: stubbed (add later)
*/

const CARD_BACK = "assets/backs/back.png";

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

let CARDS = []; // card definitions (with counts)
let GAME = null;

function showScreen(name){
  Object.entries(SCREENS).forEach(([k, el]) => el.classList.toggle('hidden', k !== name));
}

function setStatus(msg){ ui.status.textContent = msg; }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function shuffle(arr){
  for(let i=arr.length-1; i>0; i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function loadCards(){
  const res = await fetch('./data/cards.json');
  const data = await res.json();
  CARDS = data;
}

function buildDeck(){
  // Expand counts into a deck array of card instances
  const deck = [];
  for(const c of CARDS){
    const count = c.count ?? 1;
    for(let i=0; i<count; i++){
      deck.push({ ...c, instanceId: `${c.id}__${i}` });
    }
  }
  shuffle(deck);
  return deck;
}

function makeDefaultNames(n){
  const names = [];
  for(let i=0; i<n; i++) names.push(`Player ${i+1}`);
  return names;
}

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
  const names = inputs.map(i => i.value.trim()).filter(Boolean);
  return names;
}

function newGame(names){
  const deck = buildDeck();
  ui.decksize.textContent = String(deck.length);

  return {
    names,
    round: 1,
    turn: 1, // 1..9
    phase: 'gate', // gate -> choose -> (repeat) -> huli -> gate ...
    currentPicker: 0, // whose device turn to pick in the current turn
    deck,
    hands: names.map(() => []),
    // chosen to plant this turn (face-down until Huli)
    plantedFaceDown: names.map(() => null),
    // planted cards accumulated in current round
    tableaus: names.map(() => []),
    invasives: names.map(() => []), // persists across rounds
    roundScores: names.map(() => []), // per round totals
    huliRevealed: false, // cards face down
  };
}

function dealRound(){
  const n = GAME.names.length;
  const CARDS_PER_PLAYER = 9;

  // Fresh hands + tableaus for the round
  GAME.hands = GAME.names.map(() => []);
  GAME.tableaus = GAME.names.map(() => []);
  GAME.plantedFaceDown = GAME.names.map(() => null);

  const need = n * CARDS_PER_PLAYER;
  if(GAME.deck.length < need){
    // Rebuild deck if we run out
    GAME.deck = buildDeck();
    ui.decksize.textContent = String(GAME.deck.length);
  }

  for(let p=0; p<n; p++){
    for(let k=0; k<CARDS_PER_PLAYER; k++){
      GAME.hands[p].push(GAME.deck.pop());
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

function showGate(){
  showScreen('gate');
  ui.gateTitle.textContent = `Pass to ${currentPlayerName()}`;
  ui.gateSubtitle.textContent = `Tap “Reveal my hand” when ${currentPlayerName()} is ready.`;
  ui.btnPlant.disabled = true;
  setStatus(`Waiting for ${currentPlayerName()} to choose a card.`);
}

function cardTypeClass(card){
  if(card.type === 'invasive') return 'type-invasive';
  if(card.type === 'canoe') return 'type-canoe';
  if(card.type === 'resource') return 'type-resource';
  // native / endemic / indigenous
  return 'type-native';
}

let selectedInstanceId = null;

function renderHand(){
  showScreen('choose');
  ui.uiRound.textContent = String(GAME.round);
  ui.uiTurn.textContent = String(GAME.turn);

  ui.chooseTitle.textContent = `${currentPlayerName()}: choose a card to plant`;
  ui.chooseSubtitle.textContent = `Pick 1 card. It will be planted face-down.`;

  selectedInstanceId = null;
  ui.btnPlant.disabled = true;
  ui.hand.innerHTML = '';

  const hand = GAME.hands[GAME.currentPicker];

  for(const card of hand){
    const tile = document.createElement('div');
    tile.className = `cardtile ${cardTypeClass(card)}`;
    tile.dataset.instanceId = card.instanceId;

    const imgSrc = card.front ?? '';
    tile.innerHTML = `
      <div class="cardpoints">${Number(card.points ?? 0)}</div>
      <img class="cardimg" alt="${card.name}" src="${imgSrc}" onerror="this.style.display='none'">
      <div class="cardmeta">
        <div class="cardname">${card.name}</div>
        <div class="cardtype">${card.type}</div>
      </div>
    `;

    tile.addEventListener('click', () => {
      selectedInstanceId = card.instanceId;
      ui.btnPlant.disabled = false;
      Array.from(ui.hand.querySelectorAll('.cardtile')).forEach(el => el.classList.toggle('selected', el.dataset.instanceId === selectedInstanceId));
    });

    ui.hand.appendChild(tile);
  }
}

function plantSelected(){
  if(!selectedInstanceId) return;
  const p = GAME.currentPicker;

  const hand = GAME.hands[p];
  const idx = hand.findIndex(c => c.instanceId === selectedInstanceId);
  if(idx < 0) return;

  const [picked] = hand.splice(idx, 1);
  GAME.plantedFaceDown[p] = picked;

  setStatus(`${GAME.names[p]} planted a card (face-down).`);
  selectedInstanceId = null;

  // Move to next picker, or Huli if everyone has picked
  if(p < GAME.names.length - 1){
    GAME.currentPicker++;
    showGate();
  } else {
    GAME.huliRevealed = false;   // start with backs
    showHuli();
  }
}

function showHuli(){
  showScreen('huli');
  ui.huliGrid.innerHTML = '';

  const isRevealed = !!GAME.huliRevealed;

  // Update button label depending on state
  ui.btnNextTurn.textContent = isRevealed ? 'Continue' : 'Huli! Reveal';

  for(let p=0; p<GAME.names.length; p++){
    const card = GAME.plantedFaceDown[p];

    // If not revealed yet, show the shared card back
    const imgSrc = isRevealed
      ? (card.front ?? card.image ?? '')
      : CARD_BACK;

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
          <img class="cardimg" alt="${showName}" src="${imgSrc}" onerror="this.style.display='none'">
          <div class="cardmeta">
            <div class="cardname">${showName}</div>
            <div class="cardtype">${showType}</div>
          </div>
        </div>
      </div>
    `;

    ui.huliGrid.appendChild(box);
  }

  setStatus(isRevealed ? 'Huli! Revealed planted cards. Ready to pass hands.' : 'Cards are face-down. Press Huli! to reveal.');
}


function rotateHandsLeft(){
  // Pass remaining hands to the next player (left / increasing index)
  const n = GAME.names.length;
  const newHands = Array.from({length:n}, () => []);
  for(let p=0; p<n; p++){
    const to = (p + 1) % n;
    newHands[to] = GAME.hands[p];
  }
  GAME.hands = newHands;
}

function commitTurnAndContinue(){
  // Add planted cards to tableaus, track invasives, then pass hands
  for(let p=0; p<GAME.names.length; p++){
    const card = GAME.plantedFaceDown[p];
    if(!card) continue;

    GAME.tableaus[p].push(card);

    if(card.type === 'invasive'){
      GAME.invasives[p].push(card);
    }

    // Resource effects: stub (implement later)
    // if(card.type === 'resource') { ... }
    GAME.plantedFaceDown[p] = null;
  }

  rotateHandsLeft();

  // Next turn or end round
  if(GAME.turn < 9){
    GAME.turn++;
    GAME.currentPicker = 0;
    showGate();
  } else {
    endRound();
  }
}

function basicRoundScore(p){
  // MVP scoring:
  // - Sum points for non-invasive, non-resource cards
  // - Invasives are tracked separately for end-game penalty
  // - Set bonuses not implemented yet
  let s = 0;
  for(const c of GAME.tableaus[p]){
    if(c.type === 'invasive') continue;
    if(c.type === 'resource') continue;
    s += Number(c.points ?? 0);
  }
  return s;
}

function endRound(){
  // Save round totals
  const totals = [];
  for(let p=0; p<GAME.names.length; p++){
    const total = basicRoundScore(p);
    GAME.roundScores[p].push(total);
    totals.push(total);
  }

  // Render scoreboard
  showScreen('roundscore');
  ui.roundscore.innerHTML = '';
  for(let p=0; p<GAME.names.length; p++){
    const line = document.createElement('div');
    line.className = 'scoreline';
    const invCount = GAME.invasives[p].length;

    line.innerHTML = `
      <b>${GAME.names[p]}</b>
      <div class="kv">
        <span>Round ${GAME.round}: <b>${GAME.roundScores[p][GAME.round-1]}</b></span>
        <span>Invasives so far: <b>${invCount}</b></span>
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
    const sumRounds = GAME.roundScores[p].reduce((a,b)=>a+b,0);
    const penalty = penalized[p] ? 20 : 0;
    totals.push({ p, sumRounds, penalty, final: sumRounds - penalty, inv: invCounts[p] });
  }

  // Sort by final desc
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

function wireUI(){
  ui.playerCount.addEventListener('change', renderPlayerInputs);
  ui.btnStart.addEventListener('click', () => {
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
   if(!GAME.huliRevealed){
    GAME.huliRevealed = true;
    showHuli(); // re-render with fronts
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

(async function init(){
  renderPlayerInputs();
  wireUI();
  await loadCards();
  const deck = buildDeck();
  ui.decksize.textContent = String(deck.length);
  setStatus('Loaded cards. Configure players to start.');
})();
