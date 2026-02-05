#!/usr/bin/env python3
import sys
import json
import os
import shutil
import logging
from knowledge_storm import (
    STORMWikiRunnerArguments,
    STORMWikiRunner,
    STORMWikiLMConfigs,
)
from knowledge_storm.lm import OpenAIModel, LitellmModel
from knowledge_storm.rm import TavilySearchRM

# Configure logging to stderr
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', stream=sys.stderr)
logger = logging.getLogger("storm-mcp")

# Tool names
TOOL_STORM_RESEARCH = "storm_research"

def handle_request(request):
    method = request.get("method")
    params = request.get("params", {})
    request_id = request.get("id")

    logger.info(f"Handling request: {method} (id: {request_id})")

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "serverInfo": {"name": "storm-mcp", "version": "1.0.0"},
                "capabilities": {"tools": {}},
            },
        }

    elif method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "tools": [
                    {
                        "name": TOOL_STORM_RESEARCH,
                        "description": "Perform deep research on a topic and generate a comprehensive report with citations using Stanford STORM.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "topic": {
                                    "type": "string",
                                    "description": "The topic to research",
                                }
                            },
                            "required": ["topic"],
                        },
                    }
                ]
            },
        }

    elif method == "tools/call":
        name = params.get("name")
        args = params.get("arguments", {})

        if name == TOOL_STORM_RESEARCH:
            topic = args.get("topic")
            logger.info(f"Starting research on topic: {topic}")
            try:
                result = run_storm_research(topic)
                return {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": {
                        "content": [{"type": "text", "text": result}]
                    },
                }
            except Exception as e:
                logger.error(f"Error during research: {str(e)}")
                return {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "error": {"code": -32603, "message": str(e)},
                }

    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "error": {"code": -32601, "message": f"Method not found: {method}"},
    }

def run_storm_research(topic):
    # Set up keys from environment
    openai_api_key = os.getenv("LLM_PROVIDER_KEY")
    openai_api_base = os.getenv("LLM_PROVIDER_URL")
    tavily_api_key = os.getenv("TAVILY_API_KEY")
    model_name = os.getenv("LLM_PROVIDER_MODEL", "kimi-k2.5")

    if not openai_api_key or not tavily_api_key:
        raise ValueError("Missing LLM_PROVIDER_KEY or TAVILY_API_KEY in environment.")

    # STORM configurations
    lm_configs = STORMWikiLMConfigs()
    openai_kwargs = {
        "api_key": openai_api_key,
        "api_base": openai_api_base,
        "temperature": 1.0,
        "top_p": 0.9,
    }

    # Use LitellmModel as it is more robust for custom endpoints
    # For litellm, we specify the provider in the model name if needed
    litellm_model = model_name
    if not "/" in litellm_model:
        litellm_model = f"openai/{litellm_model}"
    
    # Kimi requires temperature=1.0. We ensure it's set.
    lm_kwargs = {
        "api_key": openai_api_key,
        "api_base": openai_api_base,
        "temperature": 1.0,
        "top_p": 1.0, # Kimi defaults
    }

    default_lm = LitellmModel(model=litellm_model, max_tokens=2000, **lm_kwargs)
    
    lm_configs.set_conv_simulator_lm(default_lm)
    lm_configs.set_question_asker_lm(default_lm)
    lm_configs.set_outline_gen_lm(default_lm)
    lm_configs.set_article_gen_lm(default_lm)
    lm_configs.set_article_polish_lm(default_lm)

    output_dir = os.path.abspath("storm_outputs")
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
    os.makedirs(output_dir, exist_ok=True)

    engine_args = STORMWikiRunnerArguments(
        output_dir=output_dir,
        max_conv_turn=3,
        max_perspective=3,
        search_top_k=3,
        max_thread_num=3,
    )

    rm = TavilySearchRM(tavily_search_api_key=tavily_api_key, k=engine_args.search_top_k, include_raw_content=True)

    runner = STORMWikiRunner(engine_args, lm_configs, rm)
    
    # Run STORM
    runner.run(
        topic=topic,
        do_research=True,
        do_generate_outline=True,
        do_generate_article=True,
        do_polish_article=True,
    )
    runner.post_run()

    # Read the result
    topic_dir_name = topic.replace(' ', '_').replace('/', '_')
    article_path = os.path.join(output_dir, topic_dir_name, "storm_gen_article_polished.txt")
    
    if os.path.exists(article_path):
        with open(article_path, 'r') as f:
            return f.read()
    else:
        article_path = os.path.join(output_dir, topic_dir_name, "storm_gen_article.txt")
        if os.path.exists(article_path):
            with open(article_path, 'r') as f:
                return f.read()
    
    return f"Research completed, but article file not found at {article_path}"

def main():
    logger.info("Storm MCP server started")
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
            response = handle_request(request)
            print(json.dumps(response))
            sys.stdout.flush()
        except Exception as e:
            logger.error(f"Failed to process line: {line}. Error: {e}")

if __name__ == "__main__":
    main()
