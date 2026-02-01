"""
TradingClaw Lite Demo - Verification of Markdown Tracking
"""

import sys
import os
from pathlib import Path

# Add the skill directory directly to path
sys.path.append(str(Path(__file__).parent.parent / "skill"))

# Import directly from the file, avoiding the package __init__
import research

def run_verification():
    print("--- TradingClaw Logic Verification ---")
    
    agent_id = "clawsight_01"
    base_path = Path("./demo_logs")
    tracker = research.ResearchTracker(agent_id, base_path=str(base_path))
    
    # Simulate an agent's autonomous workflow
    market_id = "poly-101"
    question = "Will Ethereum hit $5000 by 2026?"
    
    print(f"Step 1: Logging autonomous research for: {question}")
    research_notes = """
## Autonomous Analysis
The price of ETH has been consolidating. Open interest is high.
EIP-4844 impact is fully priced in. 
Forecast: Moderate growth likely.
    """
    research_file = tracker.log_research(
        market_id=market_id,
        market_question=question,
        research_notes=research_notes,
        sources=["https://etherscan.io", "https://ultrasound.money"]
    )
    
    print(f"Step 2: Logging prediction and reasoning")
    tracker.log_prediction(
        market_id=market_id,
        market_question=question,
        prediction=0.72,
        confidence="high",
        reasoning="Market price is 45%, but fundamental metrics suggest 72%.",
        market_price=0.45,
        research_file=research_file
    )
    
    print(f"Step 3: Logging simulated outcome")
    tracker.log_outcome(
        market_id=market_id,
        outcome=True,
        agent_prediction=0.72
    )
    
    print("\n--- Verification Complete ---")
    print(f"Files created in {base_path / agent_id}:")
    for f in (base_path / agent_id).rglob("*"):
        if f.is_file():
            print(f" - {f}")
    
    # Show content of one file to prove it works
    print(f"\nContent of predictions.md:")
    print((base_path / agent_id / "predictions.md").read_text())

if __name__ == "__main__":
    run_verification()
