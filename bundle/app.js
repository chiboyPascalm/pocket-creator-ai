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
  const PDF_LOGO_BASE64 = "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";
  const logoBinary = atob(PDF_LOGO_BASE64);

  const clean = String(content)
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");

  const hexText = value => Array.from(String(value), ch =>
    pdfByte(ch).toString(16).padStart(2, "0")
  ).join("").toUpperCase();

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
  clean.split("\n").forEach(line => wrap(line));

  const pageSize = 40;
  const pages = [];
  for (let i = 0; i < lines.length; i += pageSize) {
    pages.push(lines.slice(i, i + pageSize));
  }
  if (!pages.length) pages.push([]);

  const footer =
    "Chiboy Godwin Pascal | github.com/chiboyPascalm | " +
    "youtube.com/@chiboygodwinpascal | wa.me/2349135516263";

  const objects = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  // Embed the actual Pocket Creator AI colour logo as a JPEG image.
  objects[5] =
    `<< /Type /XObject /Subtype /Image /Width 128 /Height 128 ` +
    `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
    `/Length ${logoBinary.length} >>\nstream\n${logoBinary}\nendstream`;

  const pageRefs = [];

  pages.forEach((page, index) => {
    const pageId = 6 + index * 2;
    const streamId = pageId + 1;
    pageRefs.push(`${pageId} 0 R`);

    let stream = [
      // Full-width navy brand header.
      "q",
      "0.063 0.078 0.149 rg",
      "0 758 595 84 re f",
      "Q",

      // Purple and teal brand accents.
      "q",
      "0.427 0.365 0.984 rg",
      "0 758 8 84 re f",
      "0.098 0.722 0.651 rg",
      "8 758 4 84 re f",
      "Q",

      // Real Pocket Creator AI logo.
      "q",
      "42 778 44 44 cm",
      "/Im1 Do",
      "Q",

      // White brand title and tagline.
      "BT",
      "/F2 19 Tf",
      "1 1 1 rg",
      "98 803 Td",
      `<${hexText("Pocket Creator AI")}> Tj`,
      "/F1 8 Tf",
      "0.78 0.82 0.91 rg",
      "0 -17 Td",
      `<${hexText("Create. Write. Publish.")}> Tj`,
      "ET",

      // Purple and teal divider below header.
      "q",
      "0.427 0.365 0.984 rg",
      "12 755 400 3 re f",
      "0.098 0.722 0.651 rg",
      "412 755 171 3 re f",
      "Q"
    ].join("\n") + "\n";

    // Main content: purple section headings, readable dark body text.
    let y = 735;
    page.forEach(line => {
      if (!line.trim()) {
        y -= 8;
        return;
      }

      const isHeading =
        /^#{1,6}\s/.test(line) ||
        (line.length < 70 && /:$/.test(line));

      const displayLine = line
        .replace(/^#{1,6}\s*/, "")
        .replace(/\*\*/g, "");

      if (isHeading) {
        stream += [
          "BT",
          "/F2 11 Tf",
          "0.427 0.365 0.984 rg",
          `50 ${y} Td`,
          `<${hexText(displayLine)}> Tj`,
          "ET"
        ].join("\n") + "\n";
        y -= 16;
      } else {
        stream += [
          "BT",
          "/F1 10 Tf",
          "0.12 0.13 0.17 rg",
          `50 ${y} Td`,
          `<${hexText(displayLine)}> Tj`,
          "ET"
        ].join("\n") + "\n";
        y -= 12;
      }
    });

    // Light branded footer band on every page.
    stream += [
      "q",
      "0.96 0.95 0.99 rg",
      "0 0 595 62 re f",
      "Q",
      "q",
      "0.427 0.365 0.984 RG",
      "42 62 m 553 62 l S",
      "0.098 0.722 0.651 RG",
      "42 59 m 553 59 l S",
      "Q",

      // Creator details in one horizontal line.
      "BT",
      "/F1 5.2 Tf",
      "0.20 0.22 0.31 rg",
      "50 31 Td",
      `<${hexText(footer)}> Tj`,
      "/F2 7 Tf",
      "485 0 Td",
      `<${hexText(`Page ${index + 1} of ${pages.length}`)}> Tj`,
      "ET"
    ].join("\n");

    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> ` +
      `/XObject << /Im1 5 0 R >> >> /Contents ${streamId} 0 R >>`;

    objects[streamId] =
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  objects[2] =
    `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pages.length} >>`;

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

  pdf +=
    `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\n` +
    `startxref\n${xref}\n%%EOF`;

  // Preserve JPEG bytes exactly; do not UTF-8 encode the PDF binary stream.
  const pdfBytes = Uint8Array.from(pdf, ch => ch.charCodeAt(0));
  return new Blob([pdfBytes], {type: "application/pdf"});
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

function confirmDraftDeletion() {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.setAttribute("role", "presentation");
    overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:20px;";

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "draft-delete-title");
    dialog.style.cssText = "width:100%;max-width:360px;background:#151d2b;color:#fff;border:1px solid #39465a;border-radius:16px;padding:22px;box-shadow:0 18px 55px rgba(0,0,0,.45);";

    const title = document.createElement("h3");
    title.id = "draft-delete-title";
    title.textContent = "Delete saved draft?";
    title.style.cssText = "margin:0 0 10px;font-size:18px;";

    const message = document.createElement("p");
    message.textContent = "This draft will be removed from your saved drafts. This action cannot be undone.";
    message.style.cssText = "margin:0 0 20px;line-height:1.5;color:#c5cedb;";

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.style.cssText = "padding:10px 16px;border-radius:9px;border:1px solid #657187;background:#263246;color:#fff;";

    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.textContent = "Delete draft";
    confirm.style.cssText = "padding:10px 16px;border-radius:9px;border:1px solid #a64c5d;background:#8c3043;color:#fff;";

    actions.append(cancel, confirm);
    dialog.append(title, message, actions);
    overlay.appendChild(dialog);

    let finished = false;
    const finish = value => {
      if (finished) return;
      finished = true;
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      resolve(value);
    };
    const onKey = event => {
      if (event.key === "Escape") finish(false);
    };

    cancel.addEventListener("click", () => finish(false));
    confirm.addEventListener("click", () => finish(true));
    overlay.addEventListener("click", event => {
      if (event.target === overlay) finish(false);
    });
    document.addEventListener("keydown", onKey);

    document.body.appendChild(overlay);
    cancel.focus();
  });
}

async function deleteSavedDraft(id) {
  const draft = drafts.find(item => draftStorageId(item) === id);
  if (!draft) return;
  if (!(await confirmDraftDeletion())) return;

  const previousDrafts = drafts.slice();
  const previousCurrent = current;
  const removedCurrentDraft = current === draft.content;

  drafts = drafts.filter(item => draftStorageId(item) !== id);

  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(drafts));
    if (removedCurrentDraft) {
      current = "";
      el("output").textContent = "Your content will appear here after you generate a draft.";
      localStorage.setItem(LAST_DRAFT_KEY, "");
    }
  } catch (e) {
    console.warn("Could not update browser draft storage:", e);
    drafts = previousDrafts;
    current = previousCurrent;

    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(previousDrafts));
      if (removedCurrentDraft) {
        localStorage.setItem(LAST_DRAFT_KEY, previousCurrent);
      }
    } catch (restoreError) {
      console.warn("Could not restore browser draft storage:", restoreError);
    }

    if (removedCurrentDraft) {
      el("output").textContent = previousCurrent;
    }
    renderSavedDrafts();
    el("status").textContent = "Browser storage failed. Your draft was not deleted.";
    return;
  }

  if (host) {
    try {
      await host.storage.set({key: HISTORY_KEY, value: drafts});
      if (removedCurrentDraft) {
        await host.storage.set({key: LAST_DRAFT_KEY, value: ""});
      }
    } catch (e) {
      console.warn("Could not synchronize deleted draft with Anna storage:", e);
      drafts = previousDrafts;
      current = previousCurrent;
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(previousDrafts));
        if (removedCurrentDraft) localStorage.setItem(LAST_DRAFT_KEY, previousCurrent);
      } catch (restoreError) {
        console.warn("Could not restore browser draft storage:", restoreError);
      }
      try {
        await host.storage.set({key: HISTORY_KEY, value: previousDrafts});
        if (removedCurrentDraft) {
          await host.storage.set({key: LAST_DRAFT_KEY, value: previousCurrent});
        }
      } catch (restoreError) {
        console.warn("Could not restore Anna draft storage:", restoreError);
      }
      renderSavedDrafts();
      el("status").textContent = "Deletion could not be synchronized. Your draft has been restored.";
      return;
    }
  }

  renderSavedDrafts();
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
