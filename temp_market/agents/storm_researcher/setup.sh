#!/bin/bash

# STORM Researcher Setup Script
# This script prepares the environment for the STORM Researcher agent.

echo "⛈️ Starting STORM Researcher setup..."

# 1. Check for Python 3.11+
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: python3 is not installed. Please install Python 3.11 or later."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo "✅ Found Python $PYTHON_VERSION"

# 2. Clone STORM if not present
if [ ! -d "storm_repo" ]; then
    echo "📂 Cloning Stanford STORM repository..."
    git clone https://github.com/stanford-oval/storm.git storm_repo
else
    echo "✅ STORM repository already exists."
fi

# 3. Create virtual environment
if [ ! -d "venv" ]; then
    echo "🐍 Creating virtual environment..."
    python3 -m venv venv
else
    echo "✅ Virtual environment already exists."
fi

# 4. Install dependencies
echo "📦 Installing dependencies (this may take a few minutes)..."
./venv/bin/pip install --upgrade pip
./venv/bin/pip install knowledge-storm tavily-python

echo "✅ Setup complete!"
echo ""
echo "⛈️ STORM Researcher is ready."
echo "Please ensure you have configured your LLM_PROVIDER_KEY and TAVILY_API_KEY in your Eden .env file."
echo "The agent in your Eden Market will now be able to run the bridge."
