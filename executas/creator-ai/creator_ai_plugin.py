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
    "version": "0.1.2",
    "description": "Create video scripts, stories, social posts, promotions, captions and structured ebooks using Anna's language model.",
    "host_capabilities": ["llm.sample"],
    "credentials": [],
    "tools": [
        {
            "name": "generate",
            "description": "Generate polished AI content, including structured ebooks and advanced video scripts.",
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
                    "enum": ["video", "story", "social", "promo", "caption", "ebook"]
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
                },
                {
                    "name": "platform",
                    "type": "string",
                    "description": "Optional target platform for video scripts.",
                    "required": False,
                    "default": "general",
                    "enum": ["general", "youtube", "tiktok", "instagram", "facebook"]
                },
                {
                    "name": "duration",
                    "type": "string",
                    "description": "Target video duration.",
                    "required": False,
                    "default": "60 seconds",
                    "enum": ["30 seconds", "60 seconds", "90 seconds", "3 minutes", "5 minutes"]
                },
                {
                    "name": "audience",
                    "type": "string",
                    "description": "Optional target audience.",
                    "required": False,
                    "default": ""
                },
                {
                    "name": "book_length",
                    "type": "string",
                    "description": "Requested ebook size.",
                    "required": False,
                    "default": "standard",
                    "enum": ["short", "standard", "detailed"]
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
    audience = str(args.get("audience", "")).strip()
    platform = str(args.get("platform", "general")).strip().lower()
    duration = str(args.get("duration", "60 seconds")).strip().lower()
    book_length = str(args.get("book_length", "standard")).strip().lower()

    if len(business) > 500:
        raise ValueError("Business details must be 500 characters or fewer.")
    if len(audience) > 160:
        raise ValueError("Target audience must be 160 characters or fewer.")
    if not topic:
        raise ValueError("Enter a topic before generating.")
    if len(topic) > 500:
        raise ValueError("Topic must be 500 characters or fewer.")

    kind = str(args.get("kind", "caption")).strip().lower()
    tone = str(args.get("tone", "professional")).strip().lower()

    tone_instructions = ""
    if tone == "funny":
        tone_instructions = (
            "COMEDY STYLE: Professional Comedy. Make the audience genuinely laugh "
            "using clever punchlines, witty observations, amusing comparisons, "
            "relatable Nigerian humour where appropriate, and excellent comedic "
            "timing. Make the humour natural, memorable and entertaining, while "
            "keeping the writing polished and easy to understand. Avoid childish "
            "jokes, forced humour, excessive slang and repetitive punchlines. "
            "Never make up events, dates, dialogue, reactions, statistics or details "
            "to create a joke. When discussing alleged wrongdoing or a real incident, "
            "do not mock victims or treat unverified allegations as established facts. "
            "Make the storytelling funny without changing the supplied facts."
        )

    allowed_kinds = {"video", "story", "social", "promo", "caption", "ebook"}
    if kind not in allowed_kinds:
        raise ValueError("Choose a supported content format.")

    allowed_platforms = {"general", "youtube", "tiktok", "instagram", "facebook"}
    if platform not in allowed_platforms:
        platform = "general"

    allowed_durations = {
        "30 seconds", "60 seconds", "90 seconds",
        "3 minutes", "5 minutes"
    }
    if duration not in allowed_durations:
        duration = "60 seconds"

    if book_length not in {"short", "standard", "detailed"}:
        book_length = "standard"

    try:
        variation = int(args.get("variation", 0) or 0)
    except (TypeError, ValueError):
        variation = 0

    approaches = [
        "Use a practical, direct approach with a strong opening.",
        "Use a relatable mini-story or everyday situation.",
        "Lead with a surprising insight or common mistake.",
        "Use a concise, benefit-focused approach.",
        "Use a warm, community-focused approach."
    ]
    approach = approaches[variation % len(approaches)]

    audience_text = audience if audience else "General audience appropriate to the topic"
    business_text = business if business else "Not provided; do not invent details"

    rules = (
        "Write useful, original, polished content that matches the requested format. "
        "Treat the topic and supplied business details as the only source of factual "
        "information about the user's business, product, services, experience or results. "
        "Never invent prices, discounts, guarantees, delivery areas, reviews, qualifications, "
        "availability, facilities, staff, product ranges or business processes. "
        "If a detail was not supplied, omit it or clearly identify it as something the "
        "user should fill in. Do not present invented statistics, quotations or sources "
        "as real. Use natural English and Nigerian context only when relevant. "
        "Avoid generic filler and repetitive openings. "
        "Return one finished draft, not multiple alternative drafts. "
        "A variation changes the creative angle, not the underlying facts."
    )

    video_hashtag_rules = {
        "tiktok": (
            "Use 3–5 relevant hashtags. Combine specific topic or niche hashtags "
            "with a small number of suitable discovery hashtags. Avoid generic "
            "viral tags unless they genuinely fit the content."
        ),
        "youtube": (
            "Use 3–5 relevant hashtags based on the video's subject. Include "
            "#Shorts only when the script is intended for YouTube Shorts; do not "
            "add it to a regular long-form YouTube video."
        ),
        "instagram": (
            "Use 5–8 relevant hashtags, balancing specific niche tags with "
            "topic and audience discovery tags. Use #Reels when appropriate."
        ),
        "facebook": (
            "Use 3–5 relevant hashtags focused on the topic and intended audience. "
            "Use #FacebookReels only when the video is intended as a Facebook Reel."
        ),
        "general": (
            "Use 3–5 relevant hashtags that describe the actual topic and audience."
        )
    }.get(platform, "Use 3–5 relevant hashtags suited to the topic and platform.")

    if kind == "video":
        format_instructions = (
            "Create a record-ready video script for the selected platform. "
            "PLATFORM: " + platform + ". TARGET DURATION: " + duration + ". "
            "Include a compelling opening hook, timestamped scenes, visual directions, "
            "spoken narration or dialogue, on-screen text, transitions where useful, "
            "a natural closing and a platform-appropriate call to action. "
            "Keep the spoken script realistic for the requested duration. "
            "Do not pad it with unnecessary repetition. "
            "At the very end, add a separate section labelled 'Hashtags:' containing "
            "hashtags derived from the actual video topic and target audience. "
            + video_hashtag_rules + " "
            "Do not put hashtags inside spoken narration or invent trending claims."
        )
        max_tokens = 2600

    elif kind == "ebook":
        length_instructions = {
            "short": (
                "Create a concise ebook manuscript with 3–4 substantive chapters. "
                "Develop each chapter with useful explanations and practical examples."
            ),
            "standard": (
                "Create a substantial ebook manuscript with 5–6 substantive chapters. "
                "Give each chapter a clear purpose, developed explanations and practical "
                "examples or exercises where relevant."
            ),
            "detailed": (
                "Create a detailed ebook manuscript with 7–8 substantive chapters. "
                "Develop each chapter with explanations, examples and actionable guidance."
            )
        }[book_length]

        format_instructions = (
            "Create a structured ebook manuscript, not a short social-media post or "
            "a mere outline. " + length_instructions + " "
            "Use this structure: BOOK TITLE; SUBTITLE; AUTHOR line only if supplied "
            "(otherwise omit it); INTRODUCTION; TABLE OF CONTENTS; numbered chapters "
            "with meaningful headings and developed prose; CONCLUSION; KEY TAKEAWAYS. "
            "Make the chapters flow logically without repeating the same points. "
            "Use clear, accessible language for the specified audience. "
            "For factual, technical or educational subjects, distinguish established "
            "facts from advice and avoid fabricated citations or statistics. "
            "Do not invent the user's qualifications or personal experiences. "
            "If the subject is broad, establish a coherent scope and stay within it. "
            "The result should be a useful first manuscript that can be edited and "
            "expanded before publication."
        )
        max_tokens = 4500 if book_length == "detailed" else 3500

    elif kind == "story":
        format_instructions = (
            "Write a complete story with a compelling opening, coherent beginning, "
            "middle and ending, believable characters and a satisfying resolution."
        )
        max_tokens = 1800

    elif kind == "promo":
        format_instructions = (
            "Write persuasive but honest promotional copy. Explain only supported "
            "benefits and finish with a natural call to action."
        )
        max_tokens = 1600

    elif kind == "social":
        format_instructions = (
            "Write an engaging social-media post with a strong opening, useful message "
            "and natural audience engagement. Include hashtags only where appropriate."
        )
        max_tokens = 1200

    else:
        format_instructions = (
            "Write one concise, polished caption suitable for the topic and audience."
        )
        max_tokens = 1000

    prompt = (
        "You are Pocket Creator AI, an expert content writer. "
        "CONTENT TYPE: " + kind + ". "
        "TONE: " + tone + ". "
        + tone_instructions + " "
        "TOPIC: " + topic + ". "
        "TARGET AUDIENCE: " + audience_text + ". "
        "BUSINESS OR PRODUCT DETAILS: " + business_text + ". "
        "CREATIVE DIRECTION: " + approach + " "
        "VARIATION NUMBER: " + str(variation + 1) + ". "
        + format_instructions + " "
        + rules + " "
        "Return only the finished content, without explaining your process."
    )

    content = ask_anna(prompt, max_tokens=max_tokens)

    review_prompt = (
        "You are the factual editor for Pocket Creator AI. Review and improve the "
        "following draft while preserving its intended format and useful detail.\n\n"
        "CONTENT TYPE: " + kind + "\n"
        "TOPIC: " + topic + "\n"
        "TARGET AUDIENCE: " + audience_text + "\n"
        "REQUESTED TONE: " + tone + "\n"
        "COMEDY REQUIREMENTS: If the requested tone is funny, preserve genuinely "
        "amusing, polished humour, clever punchlines and natural comedic timing. "
        "Do not remove the humour merely to make the writing formal. However, never "
        "retain or introduce an unsupported factual detail for the sake of a joke.\n"
        "ONLY SUPPLIED BUSINESS DETAILS: " + business_text + "\n\n"
        "DRAFT TO REVIEW:\n" + content + "\n\n"
        "STRICT RULES:\n"
        "1. Remove unsupported factual claims and fabricated statistics or sources.\n"
        "2. Do not invent business details, personal experiences, qualifications, "
        "prices, offers, reviews or guarantees.\n"
        "3. Preserve the requested structure and all useful supported information.\n"
        "4. For ebooks, retain the title, contents, introduction, developed chapters, "
        "conclusion and takeaways. Do not reduce the manuscript to a brief outline.\n"
        "5. For video scripts, preserve the platform, timing, scenes and recording directions.\n"
        "6. For video scripts, retain a separate final 'Hashtags:' section. Keep the "
        "hashtags relevant to the topic, audience and selected platform. "
        + (video_hashtag_rules if kind == "video" else "") + "\n"
        "7. Keep the language natural, clear and appropriate for the audience.\n"
        "8. Return one revised draft only, without discussing the review process."
    )

    content = ask_anna(review_prompt, max_tokens=max_tokens)
    return {"success": True, "data": {
        "content": content,
        "topic": topic,
        "business": business,
        "kind": kind,
        "tone": tone,
        "audience": audience,
        "platform": platform,
        "duration": duration,
        "book_length": book_length,
        "provider": "anna-llm"
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
