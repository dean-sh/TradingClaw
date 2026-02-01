"""
TradingClaw - Research & Prediction Tracker

Tracks agent research and predictions as markdown files.
Agents do their OWN research - we just log what they found and predicted.
"""

import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any


class ResearchTracker:
    """
    Tracks agent research and predictions as markdown files.
    
    Each agent has a local directory structure:
    - research/YYYY-MM-DD_market-slug.md  (detailed research notes)
    - predictions.md (running log of all submitted forecasts)
    - performance.md (automated scorecard of hits/misses)
    """
    
    def __init__(self, agent_id: str, base_path: str = "./agent_logs"):
        self.agent_id = agent_id
        self.base_path = Path(base_path) / agent_id
        self.research_path = self.base_path / "research"
        
        # Ensure directories exist
        self.research_path.mkdir(parents=True, exist_ok=True)
    
    def log_research(
        self,
        market_id: str,
        market_question: str,
        research_notes: str,
        sources: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Path:
        """
        Save the agent's autonomous research to a markdown file.
        """
        timestamp = datetime.utcnow()
        date_str = timestamp.strftime("%Y-%m-%d")
        time_str = timestamp.strftime("%H:%M:%S UTC")
        
        # Create a unique filename for this market research
        slug = self._slugify(market_question)[:50]
        filename = f"{date_str}_{slug}.md"
        filepath = self.research_path / filename
        
        # Format the markdown document
        content = [
            f"# Research: {market_question}",
            "",
            f"**Market ID**: `{market_id}`",
            f"**Agent**: `{self.agent_id}`",
            f"**Timestamp**: {date_str} at {time_str}",
            "",
            "---",
            "",
            "## 🔍 Research Notes",
            "",
            research_notes,
            "",
        ]
        
        if sources:
            content.append("## 🌐 Sources")
            for source in sources:
                content.append(f"- {source}")
            content.append("")
        
        if metadata:
            content.append("## 📊 Metadata")
            for key, value in metadata.items():
                content.append(f"- **{key}**: {value}")
            content.append("")
        
        # Write the file
        filepath.write_text("\n".join(content))
        return filepath
    
    def log_prediction(
        self,
        market_id: str,
        market_question: str,
        prediction: float,
        confidence: str,
        reasoning: str,
        market_price: float,
        research_file: Path | None = None,
    ) -> None:
        """
        Append the prediction details to a central predictions.md log.
        """
        predictions_file = self.base_path / "predictions.md"
        
        timestamp = datetime.utcnow()
        date_str = timestamp.strftime("%Y-%m-%d %H:%M UTC")
        
        # Calculate market vs agent edge
        edge = prediction - market_price
        direction = "YES" if edge > 0 else "NO"
        
        # Format the log entry
        entry = [
            f"### {market_question[:100]}",
            "",
            "| Metric | Value |",
            "| :--- | :--- |",
            f"| **Date** | {date_str} |",
            f"| **Market ID** | `{market_id}` |",
            f"| **Agent Forecast** | {prediction:.1%} |",
            f"| **Market Price** | {market_price:.1%} |",
            f"| **Edge Detected** | {abs(edge):.1%} on {direction} |",
            f"| **Confidence** | {confidence} |",
            f"| **Resolution** | ⏳ Pending |",
            "",
            f"**Agent Reasoning**: {reasoning}",
        ]
        
        if research_file:
            try:
                rel_path = research_file.relative_to(self.base_path)
                entry.append(f"📄 [View Research Notes](./{rel_path})")
            except ValueError:
                entry.append(f"📄 [View Research Notes]({research_file})")
        
        entry.append("\n---\n")
        
        # Ensure header exists
        if not predictions_file.exists():
            header = f"# 🔮 Predictions Log\n\n**Agent**: `{self.agent_id}`\n\n---\n"
            predictions_file.write_text(header)
        
        # Append entry
        with open(predictions_file, "a") as f:
            f.write("\n".join(entry))
    
    def log_outcome(
        self,
        market_id: str,
        outcome: bool,  # True if YES won
        agent_prediction: float,
    ) -> None:
        """
        Log the final resolution and update the performance scorecard.
        """
        performance_file = self.base_path / "performance.md"
        
        timestamp = datetime.utcnow()
        date_str = timestamp.strftime("%Y-%m-%d")
        
        # Calculate accuracy (Brier Score)
        actual = 1.0 if outcome else 0.0
        brier_score = (agent_prediction - actual) ** 2
        
        # Determine if the signal was correct
        predicted_yes = agent_prediction >= 0.5
        correct = predicted_yes == outcome
        
        status_icon = "✅" if correct else "❌"
        outcome_str = "YES" if outcome else "NO"
        
        row = f"| {date_str} | `{market_id[:10]}...` | {agent_prediction:.1%} | {outcome_str} | {status_icon} | {brier_score:.4f} |"
        
        # Ensure header exists
        if not performance_file.exists():
            header = [
                "# 🏆 Performance Scorecard",
                "",
                f"**Agent**: `{self.agent_id}`",
                "",
                "## Historical Accuracy",
                "",
                "| Date | Market | Signal | Outcome | Accuracy | Brier Score |",
                "| :--- | :--- | :--- | :--- | :--- | :--- |",
            ]
            performance_file.write_text("\n".join(header) + "\n")
        
        # Append row
        with open(performance_file, "a") as f:
            f.write(row + "\n")
    
    def _slugify(self, text: str) -> str:
        """Create a clean filename from strings."""
        text = text.lower()
        text = re.sub(r'[^\w\s-]', '', text)
        text = re.sub(r'[\s_-]+', '-', text)
        return text.strip('-')
