import { AnnaAppRuntime } from "/static/anna-apps/_sdk/latest/index.js";

const el = id => document.getElementById(id);
let host = null, version = 0, current = "";

let drafts = [];
const HISTORY_KEY = "pocket-creator:drafts";
const LAST_DRAFT_KEY = "pocket-creator:last-draft";

try {
  const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  if (Array.isArray(saved)) drafts = saved.filter(d =>
    d && typeof d.content === "string" && d.content.trim()
  ).slice(0, 50);
} catch (e) {
  console.warn("Browser draft history is unavailable:", e);
}

function renderSavedDrafts() {
  const container = el("saved-drafts");
  if (!container) return;
  container.replaceChildren();

  if (!drafts.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "No saved drafts yet. Generate content to build your history.";
    container.appendChild(empty);
    return;
  }

  drafts.forEach((draft, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.style.display = "block";
    button.style.width = "100%";
    button.style.margin = "8px 0";
    const date = draft.createdAt
      ? new Date(draft.createdAt).toLocaleString()
      : "Saved draft";
    const preview = draft.content.replace(/\s+/g, " ").slice(0, 85);
    button.textContent = `${date} · ${draft.kind || "draft"} — ${preview}`;
    button.addEventListener("click", () => {
      current = draft.content;
      el("output").textContent = current;
      if (draft.topic) el("topic").value = draft.topic;
      if (draft.business !== undefined) el("business").value = draft.business;
      if (draft.kind) el("kind").value = draft.kind;
      if (draft.tone) el("tone").value = draft.tone;
      el("status").textContent = "Saved draft reopened.";
    });
    container.appendChild(button);
  });
}

async function saveDraftEntry(content, topic, business, kind, tone) {
  const entry = {
    id: Date.now().toString() + "-" + Math.random().toString(36).slice(2, 8),
    createdAt: new Date().toISOString(),
    topic, business, kind, tone, content
  };

  drafts = [entry, ...drafts].slice(0, 50);
  renderSavedDrafts();

  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(drafts));
    localStorage.setItem(LAST_DRAFT_KEY, content);
  } catch (e) {
    console.warn("Could not save drafts in browser storage:", e);
  }

  if (host) {
    try {
      await host.storage.set({key: HISTORY_KEY, value: drafts});
      await host.storage.set({key: LAST_DRAFT_KEY, value: content});
    } catch (e) {
      console.warn("Anna draft storage did not save the history:", e);
    }
  }
}

async function restoreDraftHistory() {
  let localDrafts = drafts.slice();
  if (host) {
    try {
      const result = await host.storage.get({key: HISTORY_KEY});
      const value = result?.value ?? result?.data?.value ?? result?.data?.data?.value;
      if (Array.isArray(value)) {
        drafts = [...value, ...localDrafts].filter(d =>
          d && typeof d.content === "string" && d.content.trim()
        );
      }
    } catch (e) {
      console.warn("Could not restore Anna draft history:", e);
    }
  }

  const seen = new Set();
  drafts = drafts.filter(d => {
    const key = d.id || `${d.createdAt || ""}:${d.content}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 50);

  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(drafts));
  } catch (e) {
    console.warn("Could not refresh browser draft history:", e);
  }
  renderSavedDrafts();

  if (!current && drafts.length) {
    current = drafts[0].content;
    el("output").textContent = current;
    el("status").textContent = "Saved draft history restored.";
  }
}


const matches = (text, re) => re.test(text);
function hashtags(topic) {
  let tags;
  if (matches(topic,/mother|mom|mum|mummy/i))
    tags=["#MotherLove","#HonorYourMother","#FamilyLove","#Gratitude"];
  else if (matches(topic,/father|dad|daddy/i))
    tags=["#FatherLove","#FamilyLove","#Gratitude","#FamilyFirst"];
  else if (matches(topic,/business|product|sell|brand|customer/i))
    tags=["#SmallBusiness","#ProductPromotion","#Entrepreneurship","#BrandStory"];
  else if (matches(topic,/motivat|success|dream|goal|discipline/i))
    tags=["#Motivation","#KeepGrowing","#PersonalGrowth","#StayFocused"];
  else if (matches(topic,/love|relationship|heart|friend/i))
    tags=["#LoveAndLife","#Relationships","#RealConnections","#LifeLessons"];
  else tags=["#YourStory","#CreativeIdeas","#DailyInspiration","#LifeLessons"];
  return [...tags,"#ContentCreator","#PocketCreatorAI"].slice(0,6).join(" ");
}

function makeDraft(topic, kind, tone, n) {
  const mom=matches(topic,/mother|mom|mum|mummy/i);
  const dad=matches(topic,/father|dad|daddy/i);
  const family= mom||dad;
  const funny=tone==="funny", pro=tone==="professional";
  const parent=mom?"mother":"father";
  const opening=mom?[
    "Behind the person I am today is a woman whose love and sacrifices mean more to me than words can explain.",
    "Some of the greatest sacrifices happen quietly, without applause. Today, I want to honor my mother.",
    "A mother's love can become a source of strength long after a difficult day has passed."
  ][n%3]:dad?[
    "A father's influence can live on through the lessons, values and courage he passes down.",
    "Today, I want to recognize the sacrifices and guidance that make a father special.",
    "Some lessons from a father stay with us long after the moment has passed."
  ][n%3]:funny?`Let's talk about ${topic}—because life is too interesting to leave this conversation untouched.`:`Have you ever stopped to think about ${topic} and what it really means in everyday life?`;
  const middle=mom
    ?"You have given your time, patience, care and strength, sometimes without asking for anything in return. There are sacrifices I may never fully understand, but I want you to know that they matter."
    :dad
    ?"Your guidance, hard work and the values you have shared can shape a life for years. Even ordinary moments can leave extraordinary lessons."
    :pro
    ?`To understand ${topic}, look at the challenge, the people affected and the practical steps that can make a difference. Clear examples help turn an idea into something useful.`
    :funny
    ?`Let's be honest: nobody has life completely figured out. We learn, we make mistakes, we laugh, and hopefully we get a little wiser along the way.`
    :`Every experience connected to ${topic} can teach us something. Look beyond the obvious, consider a real example and ask what someone watching can learn from it.`;
  const close=mom
    ?"Mom, thank you for being there and for the things you have done that I may never be able to repay. I hope my actions make you proud. Wherever life takes me, I will always carry your love in my heart."
    :dad
    ?"Dad, thank you for the lessons, the effort and the care. I will carry what you have taught me and keep working to make you proud."
    :`What has ${topic} taught you? Share your experience in the comments, and let's learn from one another.`;
  const tags=hashtags(topic);
  const caption=mom?"A tribute to the woman whose love and sacrifices helped shape my life. Thank you, Mom. ❤️":dad?"Honoring the lessons and sacrifices of my father. Thank you for everything. ❤️":`${topic} — a thought worth sharing. What does it mean to you?`;
  if(kind==="video") return `VIDEO TITLE: ${mom?"My Greatest Honor — My Mother":dad?"A Tribute to My Father":topic}\nTARGET LENGTH: 60–90 seconds\nSTYLE: ${tone}\nVERSION: ${n+1}\n\nSCENE 1 — THE HOOK (0–10 seconds)\nVISUAL: Open with a meaningful close-up, photograph or cinematic shot.\nON-SCREEN TEXT: "${topic}"\nVOICE-OVER:\n"${opening}"\n\nSCENE 2 — THE CONTEXT (10–25 seconds)\nVISUAL: Show real memories, familiar places or relevant footage.\nVOICE-OVER:\n"${mom?"Mother, your love has been a source of comfort and strength. Even in difficult moments, your care has reminded me that I am not alone.":dad?"Dad, your guidance and the effort you put into our lives have taught me lessons I continue to carry.":`When we look at ${topic} through real experiences, we begin to understand why it matters and how it affects people.`}"\n\nSCENE 3 — THE MAIN MESSAGE (25–45 seconds)\nVISUAL: Use two or three short clips. Add readable subtitles.\nVOICE-OVER:\n"${middle}"\n\nSCENE 4 — THE TURNING POINT (45–65 seconds)\nVISUAL: Show a meaningful action, a personal example or a change in mood.\nVOICE-OVER:\n"${family?`I may not be able to repay every sacrifice made by my ${parent}, but I can show my appreciation through respect, my choices and the person I become.`:`The real difference begins when we turn what we learn about ${topic} into one positive, practical action.`}"\n\nSCENE 5 — THE CLOSE (65–90 seconds)\nVISUAL: Return to the opening shot. End with your page name or logo.\nVOICE-OVER:\n"${close}"\n\nCAPTION\n${caption}\n\nHASHTAGS\n${tags}\n\nEDITING CHECKLIST\n• Record the voice-over clearly and add subtitles.\n• Use personal, relevant footage rather than random clips.\n• Keep background music lower than the narration.\n• Use only music and images you have permission to publish.\n• Add one true personal detail to make the story uniquely yours.`;

  if(kind==="story") return `TITLE: ${mom?"The Love That Never Asked for Applause":dad?"The Lessons He Left Behind":`A Story About ${topic}`}\nSTYLE: ${tone}\n\nOPENING\n${opening}\n\nTHE STORY\nChinedu had spent a long time thinking about ${topic}. At first, he believed the important things were always the ones people could see. Then an ordinary experience made him pause and look at his life differently.\n\nHe remembered the people who had stood beside him during difficult times, the advice he had once ignored, and the small acts of kindness he had almost forgotten. Slowly, he began to understand how much those moments had shaped him.\n\nTHE TURNING POINT\nInstead of waiting for a perfect opportunity, Chinedu decided to take one practical step. He listened more carefully, spoke with greater kindness and tried to put what he had learned into action.\n\nTHE ENDING\nHis circumstances did not change overnight, but his attitude did. He discovered that meaningful progress often begins with one honest decision and the courage to follow through.\n\nTHE LESSON\n${family?`Never assume that the love and sacrifices of your ${parent} go unnoticed. Show your appreciation while you can.`:`The lessons we learn from ${topic} matter most when we apply them to everyday life.`}\n\nPERSONALIZE THIS STORY\nReplace the generic character and events with real details if you want to share it as your own experience.`;

  if(kind==="social") return `${mom?"Some sacrifices are too great to be measured, and a mother's love is one of them. ❤️":dad?"Today is a reminder to appreciate the lessons, care and sacrifices of a father. ❤️":opening}\n\n${middle}\n\n${close}\n\nWhat is your experience? Share your thoughts below.\n\n${tags}`;

  if(kind==="promo") return `PRODUCT PROMOTION: ${topic}\nSTYLE: ${tone}\n\nTHE HOOK\nLooking for something that can help meet your needs? Let us introduce ${topic}.\n\nTHE VALUE\nExplain what the product or service does, who it is for and the real problem it solves. Use specific benefits you can demonstrate instead of unsupported promises.\n\nREADY-TO-USE CAPTION\nDiscover ${topic}. Tell us what you are looking for, ask your questions and let us help you decide whether it is right for you.\n\nCALL TO ACTION\nSend us a message to ask about availability and verified details.\n\nHASHTAGS\n${tags}\n\nBEFORE PUBLISHING\nAdd your actual price, clear product photos, delivery terms and correct contact information. Remove any claim you cannot verify.`;

  if(kind==="caption") return `${mom?"For the woman whose love and sacrifices helped shape my life: thank you, Mom. I will always carry your lessons in my heart. ❤️":dad?"For my father: thank you for the lessons, sacrifices and strength that continue to guide me. ❤️":funny?`Still learning, still growing, and still figuring out ${topic}. One step at a time! 😄`:pro?`A reflection on ${topic}: progress begins when we turn good intentions into meaningful action.`:`Some messages deserve a moment of reflection. Today, I am thinking about ${topic} and the lessons it continues to teach me. ❤️`}\n\n${tags}`;
  return `${opening}\n\n${middle}\n\n${close}\n\n${tags}`;
}

async function generate() {
  const topic = el("topic").value.trim().replace(/\s+/g, " ");
  const business = el("business").value.trim().replace(/\s+/g, " ");

  if (!topic) {
    el("status").textContent = "Enter a topic before generating.";
    el("topic").focus();
    return;
  }

  if (!host) {
    current = "";
    el("output").textContent = "Connect to Anna to generate AI content.";
    el("status").textContent =
      "AI generation is unavailable because the Anna host is disconnected.";
    return;
  }

  const kind = el("kind").value;
  const tone = el("tone").value;
  const n = version++;

  current = "";
  el("output").textContent = "Generating with Anna AI…";
  el("status").textContent = "Waiting for Anna AI…";

  try {
    const toolId =
      window.__ANNA_TOOL_IDS__?.["creator-ai"] ||
      "tool-chiboygodwinpascal-creator-ai-b6kws47a";

    const r = await host.tools.invoke({
      tool_id: toolId,
      method: "generate",
      args: { topic, business, kind, tone, variation: n }
    });

    const rawContent =
      typeof r === "string" ? r :
      r?.data?.data?.content ??
      r?.result?.data?.data?.content ??
      r?.data?.content ??
      r?.result?.data?.content ??
      r?.content ??
      r?.result?.content ??
      r?.text;

    const content = typeof rawContent === "string" ? rawContent : "";

    if (typeof content !== "string" || !content.trim()) {
      console.error("Unexpected Anna Executa response:", r);
      throw new Error(
        "Anna's tool returned no usable content. Check the Executa response and Cloud Agent logs."
      );
    }

    current = content.trim();
    el("output").textContent = current;
    el("status").textContent = "AI content generated successfully by Anna.";

    await saveDraftEntry(current, topic, business, kind, tone);
  } catch (e) {
    console.error("Anna AI generation failed:", e);
    current = "";
    el("output").textContent =
      "AI generation failed. No template was substituted. Please try again after the connection is fixed.";
    el("status").textContent =
      "Anna AI error: " + (e?.message || String(e));
  }
}
document.querySelectorAll(".kind-choice").forEach(button=>{
  button.addEventListener("click",()=>{
    const kind=button.dataset.kind;
    el("kind").value=kind;
    document.querySelectorAll(".kind-choice").forEach(choice=>{
      const selected=choice===button;
      choice.classList.toggle("selected",selected);
      choice.setAttribute("aria-pressed",String(selected));
    });
    el("status").textContent=button.textContent.trim()+" selected. Enter a topic and tap Generate.";
  });
});
el("generate").addEventListener("click",generate);
el("again").addEventListener("click",generate);
el("clear").addEventListener("click",()=>{el("topic").value="";el("business").value="";current="";el("output").textContent="Your next draft will appear here.";el("status").textContent="Ready for a new idea.";el("topic").focus();});
el("copy").addEventListener("click",async()=>{
  if(!current){el("status").textContent="Generate a draft first.";return;}
  try{await navigator.clipboard.writeText(current);el("status").textContent="Draft copied.";}
  catch(e){const t=document.createElement("textarea");t.value=current;document.body.appendChild(t);t.select();const ok=document.execCommand("copy");t.remove();el("status").textContent=ok?"Draft copied.":"Please select the draft and copy it manually.";}
});
try{
  host=await AnnaAppRuntime.connect();
  await host.window.set_title({title:"Pocket Creator AI"});
  await host.window.ready();
  el("status").textContent="Anna host connected. Ready to create.";
  await restoreDraftHistory();
  try {
    const saved=await host.storage.get({key:LAST_DRAFT_KEY});
    const value=saved?.value ?? saved?.data?.value ?? saved?.data?.data?.value;
    if(typeof value==="string"&&value.trim()&&!current){
      current=value;
      el("output").textContent=current;
      el("status").textContent="Previous draft restored.";
    }
  } catch(storageError) {
    console.warn("Could not restore previous draft:",storageError);
  }
}
catch(e){
  host=null;
  el("status").textContent="Anna host is disconnected. You can still create a local draft.";
}
