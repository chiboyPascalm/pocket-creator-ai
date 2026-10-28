"""Content drafting tool for Pocket Creator AI."""
import json
import re
import sys
import os
import time

WIRE_DEBUG_LOG = os.path.join(os.path.dirname(__file__), 'executa-wire-debug.log')
def wire_log(message):
    try:
        with open(WIRE_DEBUG_LOG, 'a', encoding='utf-8') as f:
            f.write(time.strftime('%H:%M:%S') + ' ' + str(message) + '\n')
    except OSError:
        # Logging must never prevent the Executa protocol from running.
        pass

MANIFEST = {
    "name": "tool-chiboygodwinpascal-creator-ai-b6kws47a",
    "display_name": "Pocket Creator AI",
    "version": "0.1.1",
    "description": "Generate original video scripts, stories, social posts, promotional copy and captions using Anna's language model.",
    "host_capabilities": ["llm.sample"],
    "credentials": [],
    "tools": [
        {
            "name": "generate",
            "description": "Generate one polished, AI-written content draft using the topic, format, tone and optional business details.",
            "parameters": [
                {
                    "name": "topic",
                    "type": "string",
                    "description": "The subject or idea for the content.",
                    "required": True
                },
                {
                    "name": "kind",
                    "type": "string",
                    "description": "Content format.",
                    "required": True,
                    "enum": ["video", "story", "social", "promo", "caption"]
                },
                {
                    "name": "tone",
                    "type": "string",
                    "description": "Desired writing tone, such as friendly, professional or persuasive.",
                    "required": True
                },
                {
                    "name": "business",
                    "type": "string",
                    "description": "Optional factual details about the business or product.",
                    "required": False,
                    "default": ""
                },
                {
                    "name": "variation",
                    "type": "integer",
                    "description": "Optional number to vary the creative approach.",
                    "required": False,
                    "default": 0
                }
            ],
            "timeout": 120
        },
        {
            "name": "ping",
            "description": "Check whether the content tool is responding.",
            "parameters": [],
            "timeout": 10
        }
    ]
}

def hashtags(topic):
    if re.search(r"mother|mom|mum|mummy", topic, re.I):
        tags = ["#MotherLove", "#HonorYourMother", "#FamilyLove", "#Gratitude"]
    elif re.search(r"father|dad|daddy", topic, re.I):
        tags = ["#FatherLove", "#FamilyLove", "#Gratitude", "#FamilyFirst"]
    elif re.search(r"business|product|sell|brand|customer", topic, re.I):
        tags = ["#SmallBusiness", "#ProductPromotion", "#Entrepreneurship"]
    elif re.search(r"motivat|success|dream|goal", topic, re.I):
        tags = ["#Motivation", "#PersonalGrowth", "#KeepGoing"]
    else:
        tags = ["#YourStory", "#CreativeIdeas", "#LifeLessons"]
    return " ".join((tags + ["#ContentCreator", "#PocketCreatorAI"])[:6])

def ask_anna(prompt, max_tokens=1200):
    import json, sys, time
    rid = 700000 + int(time.time() * 1000) % 100000
    req = {"jsonrpc":"2.0","id":rid,"method":"sampling/createMessage",
           "params":{"messages":[{"role":"user","content":
           {"type":"text","text":prompt}}],
           "maxTokens":max_tokens,"temperature":0.8}}
    print(json.dumps(req), flush=True)
    while True:
        line = sys.stdin.readline()
        if not line:
            raise RuntimeError("Anna LLM connection closed")
        try:
            msg = json.loads(line)
        except Exception:
            continue
        if msg.get("id") != rid:
            continue
        if msg.get("error"):
            raise RuntimeError(str(msg["error"]))
        result = msg.get("result", {})
        def extract(x):
            if isinstance(x, str):
                return x
            if isinstance(x, dict):
                if isinstance(x.get("text"), str):
                    return x["text"]
                for k in ("content", "message", "output", "result"):
                    if k in x:
                        value = extract(x[k])
                        if value:
                            return value
            if isinstance(x, list):
                for item in x:
                    value = extract(item)
                    if value:
                        return value
            return ""
        answer = extract(result).strip()
        if answer:
            return answer
        raise RuntimeError("Anna returned an empty response")


def generate(args):
    topic = str(args.get("topic", "")).strip()
    topic = re.sub(r"""^[\s'"“”‘’]+|[\s'"“”‘’]+$""", "", topic)
    business = str(args.get("business", "")).strip()
    if len(business) > 500:
        raise ValueError("Business details must be 500 characters or fewer.")
    kind = str(args.get("kind", "caption")).strip().lower()
    tone = str(args.get("tone", "professional")).strip().lower()
    if not topic:
        raise ValueError("Enter a topic before generating.")
    if len(topic) > 500:
        raise ValueError("Topic must be 500 characters or fewer.")
    if kind not in {"video", "story", "social", "promo", "caption"}:
        kind = "caption"
    variation = int(args.get("variation", 0) or 0)
    approaches = [
        "Use a practical, direct approach with a strong opening.",
        "Use a relatable mini-story or everyday situation.",
        "Lead with a surprising insight or common mistake.",
        "Use a concise, benefit-focused approach.",
        "Use a warm, community-focused approach."
    ]
    approach = approaches[variation % len(approaches)]
    rules = (
        "Write useful, original, polished content that matches the requested format. "
        "Treat the topic and business details as the only source of factual information. "
        "Never invent business facilities, staff, product ranges, materials, prices, "
        "discounts, guarantees, delivery areas, customer reviews, qualifications, "
        "availability, results, or service processes. "
        "Do not imply a fact merely because it sounds plausible. "
        "If a detail was not provided, omit it or invite the customer to ask the seller. "
        "For promotions, clearly explain only supported benefits and finish with a "
        "natural call to action. Do not claim a product or service has features "
        "that were not specified. "
        "For stories, provide a coherent beginning, middle, and ending. "
        "For video, write a natural spoken script suitable for recording. "
        "Use natural English and Nigerian context only when relevant. "
        "Avoid generic filler, repetitive openings, and unnecessary hashtags. "
        "Return exactly ONE finished draft per request. Never provide multiple versions, "
        "alternative drafts, a second caption, or sections separated by ***. "
        "A variation changes the creative angle, not the underlying facts. "
        "Do not invent any business fact, even if it sounds normal for marketing. "
        "Do not claim a workshop, custom tailoring, specific clothing types, "
        "quality guarantees, current availability, delivery, or production methods "
        "unless the supplied details explicitly confirm them. "
        "Return only the finished content, without explaining your process."
    )
    prompt = (
        "You are Pocket Creator AI, an expert content writer. "
        "CONTENT TYPE: " + kind + ". "
        "TONE: " + tone + ". "
        "TOPIC: " + topic + ". "
        "BUSINESS OR PRODUCT DETAILS: "
        + (business if business else "Not provided; do not invent details")
        + ". "
        "CREATIVE DIRECTION: " + approach + " "
        "VARIATION NUMBER: " + str(variation + 1) + ". "
        + rules
    )
    content = ask_anna(prompt)

    # Second pass: audit the draft against the supplied facts.
    review_prompt = (
        "You are the factual editor for Pocket Creator AI. Rewrite the draft below "
        "as ONE polished, publish-ready piece of content.\n\n"
        "CONTENT TYPE: " + kind + "\n"
        "TONE: " + tone + "\n"
        "TOPIC (the user's words, not proof of extra facts): " + topic + "\n"
        "ONLY SUPPLIED BUSINESS DETAILS: "
        + (business if business else "None supplied") + "\n\n"
        "DRAFT TO REVIEW:\n" + content + "\n\n"
        "STRICT RULES:\n"
        "1. Treat the topic and supplied business details as the only factual source.\n"
        "2. Remove or rewrite every unsupported factual claim, including implied claims.\n"
        "3. Do not invent products, clothing styles, workshops, staff, custom services, "
        "materials, quality claims, prices, offers, delivery, availability, reviews, "
        "customer experiences, or business processes.\n"
        "4. Keep only details explicitly supplied by the user. If a detail is unknown, "
        "omit it or invite the reader to ask.\n"
        "5. Keep the writing natural, useful, engaging, and appropriate for the content type.\n"
        "6. Return exactly ONE final draft. No alternatives, no explanations, no headings "
        "such as Draft 1 or Draft 2, and no *** separators.\n"
        "Return only the revised content."
    )
    content = ask_anna(review_prompt)
    return {"success": True, "data": {
        "content": content, "topic": topic, "business": business, "kind": kind,
        "tone": tone, "provider": "anna-llm"
    }}


def invoke(method, args):
    if method == "ping":
        return {"success": True, "data": {"pong": True}}
    if method == "generate":
        return generate(args)
    return {"success": False, "error": f"Unknown method: {method}"}

def main():
    for line in sys.stdin:
        if not line.strip():
            continue
        req = json.loads(line)
        params = req.get('params') or {}
        wire_log('IN id=' + str(req.get('id')) + ' method=' + str(req.get('method')) + ' tool=' + str(params.get('tool')))
        try:
            method = req.get("method")
            if method == "initialize":
                params = req.get("params") or {}
                offered = params.get("protocolVersion") or "1.1"
                protocol = offered if offered in ("1.1", "2.0") else "2.0"
                result = {
                    "protocolVersion": protocol,
                    "serverInfo": {
                        "name": MANIFEST.get("display_name", "Pocket Creator AI"),
                        "version": MANIFEST.get("version", "0.1.1")
                    },
                    "capabilities": (
                        {"sampling": {}} if protocol == "2.0" else {}
                    )
                }
            elif method == "describe":
                result = MANIFEST
            elif method == "health":
                result = {"status": "ready"}
            elif method == "invoke":
                params = req.get("params", {})
                result = invoke(params.get("tool", ""), params.get("arguments", {}))
            else:
                raise ValueError(f"Unknown RPC method: {method}")
            response = {"jsonrpc": "2.0", "id": req.get("id"), "result": result}
        except Exception as exc:
            response = {"jsonrpc": "2.0", "id": req.get("id"),
                        "error": {"code": -32601, "message": str(exc)}}
        sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
        sys.stdout.flush()
        wire_log('OUT id=' + str(response.get('id')) + ' has_result=' + str('result' in response) + ' has_error=' + str('error' in response) + (' error_detail=' + str(response.get('error', {}).get('message', '')) if isinstance(response.get('error'), dict) else ''))

if __name__ == "__main__":
    main()
