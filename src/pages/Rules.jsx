export default function Rules() {
  return (
    <div className="page">
      <div className="page-title">How to Play 📖</div>
      <div className="page-sub">Tamalo — the memory card game</div>

      <div className="rules-section">
        <h2>Objective</h2>
        <p>Have the <strong>lowest total points</strong> when someone reaches 100. The player who crosses 100 loses — the player with the fewest points wins.</p>
      </div>

      <div className="rules-section">
        <h2>Setup</h2>
        <ul>
          <li>3–6 players (more is fine too)</li>
          <li>Each player is dealt <strong>4 cards face-down</strong> in a 2×2 grid</li>
          <li>Before play starts, each player <strong>secretly peeks at 2</strong> of their 4 cards and memorizes them</li>
          <li>The rest of the deck goes in the center — flip one card to start the discard pile</li>
        </ul>
      </div>

      <div className="rules-section">
        <h2>On Your Turn</h2>
        <p style={{ marginBottom: 8 }}>Draw a card from either the <strong>deck</strong> (face-down) or the <strong>discard pile</strong> (face-up):</p>
        <ul>
          <li><strong>From the discard pile:</strong> You must swap it with one of your 4 cards</li>
          <li><strong>From the deck:</strong> Swap it with one of your cards, OR discard it and use its special power</li>
        </ul>
      </div>

      <div className="rules-section">
        <h2>Special Card Powers</h2>
        <p style={{ marginBottom: 12 }}>Discard these from the deck to activate their power:</p>
        <table className="rules-card-table">
          <thead>
            <tr><th>Card</th><th>Power</th></tr>
          </thead>
          <tbody>
            <tr><td><span className="power-badge" style={{ background: '#FEF3C7', color: '#92400E' }}>J / Valet</span></td><td>Peek at one of <strong>your own</strong> cards</td></tr>
            <tr><td><span className="power-badge" style={{ background: '#DBEAFE', color: '#1E40AF' }}>10</span></td><td>Spy — peek at <strong>one opponent's</strong> card</td></tr>
            <tr><td><span className="power-badge" style={{ background: '#F3E8FF', color: '#6B21A8' }}>Queen</span></td><td>Blind swap — exchange one of your cards with an opponent's (neither of you looks)</td></tr>
            <tr><td><span className="power-badge" style={{ background: '#DCFCE7', color: '#166534' }}>King</span></td><td>Spy on any card, then optionally swap it</td></tr>
          </tbody>
        </table>
      </div>

      <div className="rules-section">
        <h2>Slapping (Matching)</h2>
        <p>If any player discards a card (e.g. a 7) and you <em>know</em> you have the same value in your grid, you can <strong>immediately slap it</strong> onto the discard pile to discard yours too.</p>
        <p style={{ marginTop: 8 }}><strong>Wrong slap:</strong> If you're wrong, you must take a penalty card and add it face-down to your grid.</p>
      </div>

      <div className="rules-section">
        <h2>Calling Tamalo!</h2>
        <p>On your turn, if you believe your hand total is the lowest, shout <strong>"Tamalo!"</strong>. Every other player gets one final turn, then everyone reveals.</p>
        <ul style={{ marginTop: 8 }}>
          <li>If you <strong>do</strong> have the lowest score → you get <strong>0 points</strong> for the round</li>
          <li>If someone else has a lower score → you get a <strong>+5 penalty</strong></li>
        </ul>
      </div>

      <div className="rules-section">
        <h2>Scoring</h2>
        <table className="rules-card-table">
          <thead>
            <tr><th>Card</th><th>Points</th></tr>
          </thead>
          <tbody>
            <tr><td>Ace</td><td>1</td></tr>
            <tr><td>2 – 10</td><td>Face value</td></tr>
            <tr><td>Jack / Queen / Black King</td><td>10</td></tr>
            <tr><td>Red King</td><td>0</td></tr>
            <tr><td>Joker</td><td style={{ color: '#7C3AED', fontWeight: 700 }}>−3</td></tr>
          </tbody>
        </table>
      </div>

      <div className="rules-section">
        <h2>The 99 Rule</h2>
        <p>If a player's running total reaches <strong>exactly 99</strong>, their score is automatically reset to <strong>50</strong>. Lucky break!</p>
      </div>

      <div className="rules-section">
        <h2>Game Over</h2>
        <p>When any player's score hits <strong>100 or more</strong>, the game ends. That player <strong>loses</strong>. The player with the lowest score wins.</p>
      </div>
    </div>
  )
}
