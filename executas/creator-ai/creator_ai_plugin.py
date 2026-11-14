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
    "version": "0.1.8",
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


HASHTAG_POLICIES = {
    "tiktok": (3, 5),
    "youtube": (3, 5),
    "instagram": (5, 8),
    "facebook": (3, 5),
    "general": (3, 5),
}


def normalize_hashtags(value, maximum=8):
    """Extract hashtags, remove duplicates, preserve order and original spelling."""
    found = re.findall(r"(?<!\w)#[\w]+", str(value or ""), flags=re.UNICODE)
    result = []
    seen = set()
    for tag in found:
        key = tag.casefold()
        if key not in seen:
            seen.add(key)
            result.append(tag)
        if len(result) >= maximum:
            break
    return result



def safe_topic_hashtags(topic, minimum=3, maximum=5):
    """Build relevant, neutral hashtags from the topic and curated categories."""
    words = re.findall(r"[^\W_]+", str(topic or ""), flags=re.UNICODE)
    if not words:
        words = ["Topic"]

    def make_tag(parts):
        value = "".join(parts)
        value = re.sub(r"[^\w]", "", value, flags=re.UNICODE)
        return "#" + value if value else ""

    title_words = [word[:1].upper() + word[1:] for word in words]

    # Curated category labels describe topic areas, not unverified claims.
    related_tags = {
        "handmade": ["#HandmadeCrafts"],
        "handcrafted": ["#HandmadeCrafts"],
        "bag": ["#BagStyle", "#Accessories"],
        "bags": ["#BagStyle", "#Accessories"],
        "handbag": ["#BagStyle", "#Accessories"],
        "handbags": ["#BagStyle", "#Accessories"],
        "mother": ["#Motherhood", "#FamilyLove"],
        "mom": ["#Motherhood", "#FamilyLove"],
        "mum": ["#Motherhood", "#FamilyLove"],
        "father": ["#Fatherhood", "#FamilyLove"],
        "dad": ["#Fatherhood", "#FamilyLove"],
        "business": ["#SmallBusiness", "#Entrepreneurship"],
        "entrepreneurship": ["#SmallBusiness", "#BusinessIdeas"],
        "food": ["#FoodIdeas", "#FoodLovers"],
        "recipe": ["#FoodIdeas", "#Cooking"],
        "recipes": ["#FoodIdeas", "#Cooking"],
        "fitness": ["#FitnessJourney", "#HealthyLifestyle"],
        "workout": ["#FitnessJourney", "#Exercise"],
        "travel": ["#TravelIdeas", "#TravelCommunity"],
        "beauty": ["#BeautyTips", "#BeautyCommunity"],
        "fashion": ["#FashionStyle", "#StyleInspiration"],
        "education": ["#Learning", "#Education"],
        "learning": ["#Learning", "#Education"],
        "technology": ["#TechTopics", "#Technology"],
        "motivation": ["#Motivation", "#PersonalGrowth"],
        "leadership": ["#LeadershipSkills", "#LeadershipDevelopment"],
        "story": ["#Storytelling", "#CreativeWriting"],
        "stories": ["#Storytelling", "#CreativeWriting"],
    }

    candidates = [make_tag(title_words)]
    candidates.extend(make_tag([word]) for word in title_words)

    for word in words:
        candidates.extend(related_tags.get(word.casefold(), []))

    result = []
    seen = set()
    for tag in candidates:
        if not tag or tag == "#":
            continue
        key = tag.casefold()
        if key not in seen:
            seen.add(key)
            result.append(tag)
        if len(result) >= maximum:
            break

    fallback_tags = [
        "#ContentCreator",
        "#PocketCreatorAI",
        "#ContentIdeas",
        "#SocialMediaContent",
    ]
    for tag in fallback_tags:
        if len(result) >= minimum or len(result) >= maximum:
            break
        if tag.casefold() not in seen:
            seen.add(tag.casefold())
            result.append(tag)

    return result[:maximum]


def build_safe_promo(topic, business):
    """Construct promo copy without asking a model to invent product claims."""
    clean_topic = str(topic or "").strip()
    clean_business = str(business or "").strip()

    if not clean_topic:
        raise ValueError("A promotional topic is required.")

    heading = "**" + clean_topic + "**"
    if clean_business:
        return heading + "\n\n" + clean_business

    return (
        heading
        + "\n\n"
        + "[Add verified product or business details here before using this promotion.]"
    )

def enforce_hashtag_section(content, kind, platform, topic, audience, business):
    """Ensure video and promotional drafts end with a valid platform-specific section."""
    if kind == "promo":
        minimum, maximum = HASHTAG_POLICIES.get(
            platform, HASHTAG_POLICIES["general"]
        )
        tags = safe_topic_hashtags(topic, minimum, maximum)
        # Remove any pre-existing model-supplied hashtag section before
        # appending the deterministic, topic-derived hashtags.
        base = re.split(
            r"(?im)^[ \\t]*hashtags?[ \\t]*:?[ \\t]*$",
            content,
            maxsplit=1,
        )[0].rstrip()
        return base + "\n\nHashtags:\n" + " ".join(tags)

    if kind != "video":
        return content

    minimum, maximum = HASHTAG_POLICIES.get(platform, HASHTAG_POLICIES["general"])
    headings = list(re.finditer(
        r"(?im)^[ \t]*hashtags?[ \t]*:?[ \t]*$",
        content
    ))

    existing = []
    first_heading = headings[0] if headings else None
    last_heading = headings[-1] if headings else None

    if last_heading:
        existing = normalize_hashtags(content[last_heading.end():], maximum)

    if minimum <= len(existing) <= maximum:
        base = content[:first_heading.start()].rstrip()
        return base + "\n\nHashtags:\n" + " ".join(existing)

    count_rule = (
        f"Return exactly {minimum} to {maximum} unique hashtags."
        if minimum == maximum
        else f"Return between {minimum} and {maximum} unique hashtags."
    )
    repair_prompt = (
        "Create only a final hashtag section for this content. "
        "Return hashtags only, with no explanation, heading or other prose.\n"
        f"CONTENT TYPE: {kind}\n"
        f"TOPIC: {topic}\n"
        f"TARGET AUDIENCE: {audience or 'General audience appropriate to the topic'}\n"
        f"SUPPLIED BUSINESS OR PRODUCT DETAILS: {business or 'Not provided'}\n"
        f"PLATFORM: {platform}\n"
        f"{count_rule}\n"
        "Use neutral hashtags based on words and categories explicitly supported "
        "by the topic, supplied product or service details and audience. A topic "
        "does not prove product properties or benefits. Never imply unverified "
        "ingredients, materials, quality, certifications, performance, outcomes, "
        "popularity or customer results in a hashtag. Do not claim that any hashtag "
        "is trending. Do not add #Shorts, #Reels or #FacebookReels unless that exact "
        "format was explicitly requested. Do not invent a product, service or audience."
    )

    repaired = normalize_hashtags(ask_anna(repair_prompt, max_tokens=220), maximum)
    if not minimum <= len(repaired) <= maximum:
        raise RuntimeError(
            f"Anna did not return a valid hashtag set for {platform}. "
            "Please try generating again."
        )

    base = content[:headings[0].start()].rstrip() if headings else content.rstrip()
    return base + "\n\nHashtags:\n" + " ".join(repaired)


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


def safe_promo_hook(hook, topic):
    """Accept only a short, topic-bound question with neutral wording."""
    hook = str(hook or "").strip()
    clean_topic = str(topic or "").strip()

    allowed_words = {
        "curious", "about", "looking", "for", "interested", "in",
        "want", "to", "know", "more", "explore", "learn", "discover",
        "what", "why", "how", "are", "you", "think", "consider"
    }

    valid = (
        bool(clean_topic)
        and bool(hook)
        and len(hook) <= 120
        and "\n" not in hook
        and hook.endswith("?")
        and clean_topic.casefold() in hook.casefold()
    )

    words = re.findall(r"[a-z0-9']+", hook.casefold())
    topic_words = set(re.findall(r"[a-z0-9']+", clean_topic.casefold()))

    if not words or not topic_words or not set(words).issubset(topic_words | allowed_words):
        valid = False

    if valid:
        return hook

    return "Curious about " + clean_topic + "?"


def build_promo_copy(hook, business):
    """Assemble promotional copy without rewriting supplied business facts."""
    parts = ["**" + str(hook).strip() + "**"]
    clean_business = str(business or "").strip()

    if clean_business:
        parts.append(clean_business)
    else:
        parts.append(
            "[Add verified product or business details here before publishing.]"
        )

    parts.append("Want to know more? Request additional information.")
    return "\n\n".join(parts)


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
        "Use a concise, fact-neutral approach focused on the supplied topic and verified details.",
        "Use a warm, community-focused approach."
    ]
    approach = approaches[variation % len(approaches)]

    audience_text = audience if audience else "General audience appropriate to the topic"
    business_text = business if business else "Not provided; do not invent details"

    rules = (
        "Write useful, original, polished content that matches the requested format. "
        "FACTUAL SOURCE LIMIT: Use only facts explicitly supplied in the topic, "
        "business details and audience fields. The topic is a subject, not proof that "
        "a product or service has any particular feature, ingredient, material, "
        "performance, result, qualification, certification, price or benefit. "
        "Do not infer or invent product features, service capabilities, customer "
        "outcomes, suitability, popularity, quality, availability, guarantees, "
        "discounts, delivery areas, reviews, facilities, staff, product ranges or "
        "business processes. Do not turn a possible benefit into a factual promise. "
        "Do not claim that a product solves a problem unless that claim is explicitly "
        "supported by supplied details. If information is missing, omit the claim "
        "or use a clearly labelled placeholder for the user to complete. "
        "Keep persuasive language focused on the supplied subject and verified facts. "
        "Do not present invented statistics, quotations, testimonials or sources as real. "
        "Use natural English and Nigerian context only when relevant. "
        "Avoid generic filler and repetitive openings. "
        "Return one finished draft, not multiple alternative drafts. "
        "A variation changes the creative angle, never the underlying facts."
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
            "Write persuasive but honest promotional copy for the selected platform. "
            "PLATFORM: " + platform + ". Use only product and business facts explicitly "
            "present in the supplied details. Do not assume what the product does, "
            "who it benefits, what problem it solves, how it performs or what results "
            "customers will get. If no factual product description was supplied, "
            "write neutral introductory copy around the supplied topic and invite "
            "the audience to request more information. Do not invent benefits or "
            "make performance, quality, safety, health, financial or other outcome "
            "promises. Finish with a natural, non-pressuring call to action. "
            "At the very end, add a separate section labelled 'Hashtags:' containing "
            "neutral, topic-relevant hashtags. Hashtags must not imply unverified "
            "product properties, certifications, results or popularity. "
            + video_hashtag_rules + " "
            "Do not put hashtags inside the promotional copy or invent trending claims. "
            "Do not add video-format tags such as #Shorts, #Reels or #FacebookReels "
            "unless that exact format was explicitly requested."
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

    if kind == "promo":
        # Anna generates only a non-assertive hook. The application validates
        # it and assembles the rest from the user's exact supplied business text.
        promo_prompt = (
            "You are Pocket Creator AI. Write exactly ONE short promotional "
            "question-style hook containing the exact topic phrase below. "
            "Do not write a product description, factual statement, benefit, "
            "claim, promise, feature, call to action, hashtag or explanation. "
            "Use only neutral framing words such as Curious about, Looking for, "
            "or Interested in. The entire response must be one question ending "
            "with a question mark. Do not add any words that describe or praise "
            "the product or business.\n"
            "TOPIC: " + topic + "\n"
            "TONE: " + tone + "\n"
            "CREATIVE DIRECTION: " + approach + "\n"
            "Return only the single question."
        )
        generated_hook = ask_anna(promo_prompt, max_tokens=100)
        hook = safe_promo_hook(generated_hook, topic)
        content = build_promo_copy(hook, business)

    else:
        content = ask_anna(prompt, max_tokens=max_tokens)

        review_prompt = (
            "You are the factual editor for Pocket Creator AI. Review and improve "
            "the following draft while preserving its intended format and useful detail.\n\n"
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
            "6. For video scripts, retain a separate final 'Hashtags:' section. "
            "Keep hashtags relevant to the topic, audience and selected platform. "
            + (video_hashtag_rules if kind == "video" else "") + "\n"
            "7. Keep the language natural, clear and appropriate for the audience.\n"
            "8. Return one revised draft only, without discussing the review process."
        )
        content = ask_anna(review_prompt, max_tokens=max_tokens)

    if kind in {"video", "promo"}:
        content = enforce_hashtag_section(
            content, kind, platform, topic, audience, business
        )
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
