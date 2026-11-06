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


function pdfByte(char) {
  const special = {
    "€": 128, "‚": 130, "ƒ": 131, "„": 132, "…": 133,
    "†": 134, "‡": 135, "ˆ": 136, "‰": 137, "Š": 138,
    "‹": 139, "Œ": 140, "Ž": 142, "‘": 145, "’": 146,
    "“": 147, "”": 148, "•": 149, "–": 150, "—": 151,
    "˜": 152, "™": 153, "š": 154, "›": 155, "œ": 156,
    "ž": 158, "Ÿ": 159
  };
  const code = special[char] ?? char.codePointAt(0);
  return code >= 32 && code <= 255 ? code : 63;
}

function makePdf(title, content) {
  const clean = String(content)
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");

  const lines = [];
  const wrap = (value, width = 88) => {
    if (!value) {
      lines.push("");
      return;
    }
    let remaining = value;
    while (remaining.length > width) {
      let cut = remaining.lastIndexOf(" ", width);
      if (cut < 1) cut = width;
      lines.push(remaining.slice(0, cut));
      remaining = remaining.slice(cut).trimStart();
    }
    if (remaining) lines.push(remaining);
  };

  wrap(title.toUpperCase(), 75);
  lines.push("");
  wrap("Created with Pocket Creator AI");
  lines.push("");
  clean.split("\n").forEach(line => wrap(line));

  const pageSize = 52;
  const pages = [];
  for (let i = 0; i < lines.length; i += pageSize) {
    pages.push(lines.slice(i, i + pageSize));
  }
  if (!pages.length) pages.push([]);

  const objects = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

  const pageRefs = [];
  pages.forEach((page, index) => {
    const pageId = 4 + index * 2;
    const streamId = pageId + 1;
    pageRefs.push(`${pageId} 0 R`);

    let stream = "BT\n/F1 10 Tf\n50 790 Td\n14 TL\n";
    page.forEach(line => {
      const hex = Array.from(line, ch =>
        pdfByte(ch).toString(16).padStart(2, "0")
      ).join("").toUpperCase();
      stream += `<${hex}> Tj\nT*\n`;
    });
    stream += `\n/F1 8 Tf\n50 30 Td\n<5061676520${(index + 1).toString(16).toUpperCase()}0F${pages.length.toString(16).toUpperCase()}> Tj\nET`;

    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`;
    objects[streamId] =
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  objects[2] = `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pages.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], {type: "application/pdf"});
}

function downloadPdf(title, content) {
  if (!content || !content.trim()) {
    el("status").textContent = "There is no draft content to download.";
    return;
  }
  try {
    const blob = makePdf(title || "Pocket Creator AI Draft", content);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const filename = (title || "pocket-creator-draft")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    link.href = url;
    link.download = `${filename || "pocket-creator-draft"}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    el("status").textContent = "PDF download prepared.";
  } catch (e) {
    console.error("PDF export failed:", e);
    el("status").textContent = "PDF export failed: " + (e.message || String(e));
  }
}

function draftStorageId(draft) {
  return draft.id || `${draft.createdAt || ""}:${draft.content}`;
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

  drafts.forEach(draft => {
    const item = document.createElement("div");
    item.className = "draft-entry";

    const open = document.createElement("button");
    open.type = "button";
    open.className = "secondary draft-open";
    const date = draft.createdAt
      ? new Date(draft.createdAt).toLocaleString()
      : "Saved draft";
    const preview = draft.content.replace(/\s+/g, " ").slice(0, 85);
    open.textContent = `${date} · ${draft.kind || "draft"} — ${preview}`;
    open.addEventListener("click", () => {
      current = draft.content;
      el("output").textContent = current;
      if (draft.topic) el("topic").value = draft.topic;
      if (draft.business !== undefined) el("business").value = draft.business;
      if (draft.kind) {
        el("kind").value = draft.kind;
        updateFormatSettings(draft.kind);
        document.querySelectorAll(".kind-choice").forEach(button => {
          const selected = button.dataset.kind === draft.kind;
          button.classList.toggle("selected", selected);
          button.setAttribute("aria-pressed", String(selected));
        });
      }
      if (draft.tone) el("tone").value = draft.tone;
      if (draft.platform) el("platform").value = draft.platform;
      if (draft.duration) el("duration").value = draft.duration;
      if (draft.audience !== undefined) el("audience").value = draft.audience;
      if (draft.book_length) el("book-length").value = draft.book_length;
      el("status").textContent = "Saved draft reopened.";
    });

    const actions = document.createElement("div");
    actions.className = "draft-entry-actions";

    const pdf = document.createElement("button");
    pdf.type = "button";
    pdf.className = "secondary";
    pdf.textContent = "Download PDF";
    pdf.addEventListener("click", () =>
      downloadPdf(draft.topic || draft.kind || "Pocket Creator Draft", draft.content)
    );

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary draft-delete";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => deleteSavedDraft(draftStorageId(draft)));

    actions.append(pdf, remove);
    item.append(open, actions);
    container.appendChild(item);
  });
}

async function deleteSavedDraft(id) {
  const draft = drafts.find(item => draftStorageId(item) === id);
  if (!draft) return;
  if (!window.confirm("Delete this saved draft? This cannot be undone.")) return;

  const removedCurrentDraft = current === draft.content;
  drafts = drafts.filter(item => draftStorageId(item) !== id);
  renderSavedDrafts();

  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(drafts));
    if (removedCurrentDraft) {
      current = "";
      el("output").textContent = "Your content will appear here after you generate a draft.";
      localStorage.setItem(LAST_DRAFT_KEY, "");
    }
  } catch (e) {
    console.warn("Could not update browser draft storage:", e);
  }

  if (host) {
    try {
      await host.storage.set({key: HISTORY_KEY, value: drafts});
      if (removedCurrentDraft) {
        await host.storage.set({key: LAST_DRAFT_KEY, value: ""});
      }
    } catch (e) {
      console.warn("Could not synchronize deleted draft with Anna storage:", e);
      el("status").textContent = "Draft removed here, but Anna storage could not be synchronized.";
      return;
    }
  }
  el("status").textContent = "Saved draft deleted.";
}

async function saveDraftEntry(content, topic, business, kind, tone, settings = {}) {
  const entry = {
    id: Date.now().toString() + "-" + Math.random().toString(36).slice(2, 8),
    createdAt: new Date().toISOString(),
    topic, business, kind, tone,
    platform: settings.platform || "general",
    duration: settings.duration || "60 seconds",
    audience: settings.audience || "",
    book_length: settings.book_length || "standard",
    content
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
      args: {
        topic, business, kind, tone, variation: n,
        platform: el("platform").value,
        duration: el("duration").value,
        audience: el("audience").value.trim(),
        book_length: el("book-length").value
      }
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

    await saveDraftEntry(current, topic, business, kind, tone, {
      platform: el("platform").value,
      duration: el("duration").value,
      audience: el("audience").value.trim(),
      book_length: el("book-length").value
    });
  } catch (e) {
    console.error("Anna AI generation failed:", e);
    current = "";
    el("output").textContent =
      "AI generation failed. No template was substituted. Please try again after the connection is fixed.";
    el("status").textContent =
      "Anna AI error: " + (e?.message || String(e));
  }
}
function updateFormatSettings(kind) {
  const isVideo = kind === "video";
  const isEbook = kind === "ebook";
  const showAdvanced = isVideo || isEbook;

  el("advanced-settings-header").hidden = !showAdvanced;
  el("video-platform-setting").hidden = !isVideo;
  el("video-duration-setting").hidden = !isVideo;
  el("ebook-size-setting").hidden = !isEbook;
  el("audience-setting").hidden = !showAdvanced;
}

document.querySelectorAll(".kind-choice").forEach(button=>{
  button.addEventListener("click",()=>{
    const kind=button.dataset.kind;
    el("kind").value=kind;
    updateFormatSettings(kind);
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
el("download-current").addEventListener("click",()=>downloadPdf(el("topic").value.trim() || el("kind").value || "Pocket Creator Draft",current));
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
