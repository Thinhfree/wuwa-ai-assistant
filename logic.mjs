/* Offline-only quest parsing. Not a game knowledge base. */
export const CATEGORIES = Object.freeze({
  explore: 'Khám phá / tìm đường',
  dialogue: 'NPC / hội thoại',
  fight: 'Chiến đấu',
  puzzle: 'Giải đố / cơ quan',
  collect: 'Thu thập / tìm vật phẩm',
  unknown: 'Chưa xác định'
});

const RULES = [
  { id:'puzzle', re:/\b(puzzle|solve|mechanism|device|terminal|switch|rotate|align|pylon|pressure plate|signal|pattern|laser|light beam|frequency|connect|cipher|code)\b|giải đố|cơ quan|câu đố|mật mã|kích hoạt thiết bị|xoay|chỉnh tín hiệu|đặt khối|công tắc/i },
  { id:'fight', re:/\b(defeat|eliminate|kill|battle|combat|enemy|enemies|tacet discord|boss|challeng(?:e|ing)|fight|clear the wave)\b|đánh bại|tiêu diệt|kẻ địch|chiến đấu|thử thách|con trùm/i },
  { id:'collect', re:/\b(collect|gather|obtain|pick up|retrieve|find the (?:item|object|material)|investigate the object|loot|materials|supply)\b|thu thập|nhặt|vật phẩm|nguyên liệu|tìm món đồ/i },
  { id:'dialogue', re:/\b(talk to|speak to|ask|converse|dialogue|meet with|report back to|return to|interview)\b|nói chuyện|trò chuyện|báo cáo|gặp npc|gặp nhân vật/i },
  { id:'explore', re:/\b(go to|head to|reach|navigate|follow|track|locate|search for|enter|exit|explore|investigate|travel|proceed|find a way|walk around|look around|move around|look for|check the area|check around)\b|đi tới|di chuyển|đến khu vực|đi theo|tìm đường|khám phá|điều tra|tìm kiếm|đến gặp|đi xung quanh|đi quanh/i }
];

export function cleanText(value) {
  return String(value ?? '').replace(/\r/g, '').replace(/[\u200b-\u200d\ufeff]/g, '')
    .split('\n').map(x=>x.replace(/[ \t]{2,}/g,' ').trim())
    .filter(Boolean).slice(0,90).join('\n').slice(0,5000);
}

export function guessCategory(text) {
  const s = cleanText(text);
  for (const rule of RULES) if (rule.re.test(s)) return rule.id;
  return 'unknown';
}

// OCR toàn màn hình thường chứa tên nhiều quest + menu. Chỉ đọc dòng mục tiêu,
// không dùng chữ từ menu để suy đoán loại nhiệm vụ.
const OBJECTIVE_ACTION = /\b(walk around|look around|look for|check around|talk to|speak to|go to|reach|defeat|collect|obtain|investigate|follow|search for|head to|activate|interact with|solve|find|enter|meet|return to|use the|wait for|proceed to|move to|explore|travel to)\b|nói chuyện|đánh bại|tìm|đến|nhặt|thu thập|kích hoạt|điều tra|hoàn thành|tiêu diệt|đi quanh|đi xung quanh/i;
const TRAILING_METERS = /\s+\d{1,4}\s*m\s*$/i;
function getObjectiveMatch(raw) {
  const lines = cleanText(raw).split('\n').filter(Boolean);
  const candidates=[];
  for (const [i,line] of lines.entries()) {
    const m = OBJECTIVE_ACTION.exec(line);
    if (!m || line.length < 9 || line.length > 230) continue;
    // Bỏ tên quest và ký tự UI ở đầu khi OCR ghép tên + mục tiêu trên một dòng.
    const objective=line.slice(m.index).replace(TRAILING_METERS,'').trim();
    if (objective.length < 10 || objective.length > 180) continue;
    if (/^(?:find|search|meet|follow|enter)\s*$/i.test(objective)) continue;
    let score=10;
    if (/\b(walk around|look around|talk to|speak to|defeat|collect|investigate|interact with|activate|go to|head to|reach)\b/i.test(objective)) score+=8;
    if (TRAILING_METERS.test(line)) score+=7;
    if (objective.length>22 && objective.length<145) score+=5;
    if (/\b(quest|quests|press|controls|menu|setting|objective:)\b/i.test(objective)) score-=10;
    candidates.push({line,i,objective,score,start:m.index});
  }
  candidates.sort((a,b)=>b.score-a.score || a.i-b.i);
  return candidates[0] || null;
}

export function pickObjective(raw) {
  return getObjectiveMatch(raw)?.objective || '';
}

function titleCandidate(raw) {
  // Chỉ tự gợi ý tên nếu có đặc điểm giống tên quest, tránh tên menu/biểu tượng.
  const cleaned=String(raw||'').trim()
    .replace(/^(?:[\W\d_]+|[a-z]{1,2}\s+(?=[A-Z]))+/,'')
    .replace(/^[\s|:.,;-]+|[\s|:.,;-]+$/g,'');
  if (cleaned.length<11 || cleaned.length>90 || /\b(quests?|menu|journal|track|completed|rewards|details)\b/i.test(cleaned)) return '';
  const words=cleaned.split(/\s+/);
  if(words.length<3 || words.length>13) return '';
  // Tên quest thường dùng title case hoặc chữ hoa đầu câu.
  if(!/^[A-ZÀ-Ỹ]/.test(cleaned)) return '';
  if(/[.!?]$/.test(cleaned)) return '';
  return cleaned;
}

export function pickQuestTitle(raw) {
  const match=getObjectiveMatch(raw);
  if(!match) return '';
  // Trường hợp: "Dawn Breaks on Dark Tides Walk around the venue..."
  const inline=titleCandidate(match.line.slice(0,match.start));
  if(inline) return inline;
  // Trường hợp tên quest là dòng ngay trước mục tiêu.
  const lines=cleanText(raw).split('\n');
  for(let j=match.i-1;j>=Math.max(0,match.i-2);j--){
    const candidate=titleCandidate(lines[j]);
    if(candidate) return candidate;
  }
  return '';
}

const COMMON_START = [
  'Mở danh sách nhiệm vụ trong game, chọn “Track / Theo dõi” để hiện dấu chỉ đường.',
  'Kiểm tra mục tiêu đang hiển thị và đánh dấu đã xong sau mỗi thao tác.'
];
const CATEGORY_STEPS = {
  explore: [
    'Mở bản đồ, quan sát biểu tượng chỉ đường; kiểm tra chiều cao của điểm đích (trên cao hoặc dưới lòng đất).',
    'Đi tới vùng được đánh dấu, quan sát cả phía trên/dưới hoặc đi quanh khu vực để kích hoạt mục tiêu.',
    'Khi tới vùng mục tiêu, tìm điểm tương tác hoặc NPC được đánh dấu.'
  ],
  dialogue: [
    'Theo dõi nhiệm vụ và đến đúng vị trí NPC (kiểm tra cả tầng trên/dưới).',
    'Nói chuyện với NPC và đọc tùy chọn hội thoại có dấu nhiệm vụ.',
    'Nếu chưa cập nhật, thử nói chuyện lại hoặc kiểm tra điều kiện tiên quyết.'
  ],
  fight: [
    'Đến vùng chỉ định, kiểm tra thử thách / dấu giao chiến.',
    'Hoàn thành giao chiến theo mục tiêu hiện trên màn hình.',
    'Sau khi thắng, kiểm tra tương tác hoặc mục tiêu mới; đôi khi cần nhận phần thưởng trong khu vực.'
  ],
  collect: [
    'Đọc chính xác tên vật phẩm và số lượng được yêu cầu.',
    'Dùng dấu chỉ đường để tìm vật phẩm; chú ý những vật thể có thể tương tác.',
    'Kiểm tra lại số lượng và quay về NPC / vị trí nộp nếu nhiệm vụ yêu cầu.'
  ],
  puzzle: [
    'Quan sát toàn bộ khu vực để xác định các thiết bị, ký hiệu, màu sắc và manh mối.',
    'Thử xác định quy tắc từ ký hiệu/chuỗi/tín hiệu trước khi tương tác.',
    'Nếu bị kẹt, chụp cận cảnh toàn bộ câu đố và dùng chế độ AI hình ảnh để được phân tích cụ thể.'
  ],
  unknown: [
    'Cắt ảnh sao cho chỉ còn khung tên nhiệm vụ và dòng mục tiêu rồi chạy OCR lại.',
    'Nếu giao diện game dùng tiếng Anh, chọn OCR English; nếu dùng tiếng Việt, chọn Vietnamese.',
    'Nhập tên nhiệm vụ thủ công hoặc tra hướng dẫn qua nút tìm trên web.'
  ]
};

export function buildGuide({ title='', objective='', ocr='', kind='auto' }={}) {
  const cleanTitle = (String(title).trim() || pickQuestTitle(ocr)).slice(0,140);
  const raw = cleanText(ocr);
  const resolvedObjective = String(objective).trim().slice(0,300) || pickObjective(raw);
  // Ưu tiên MỤC TIÊU, không cho chữ menu OCR kích hoạt nhầm loại 'Giải đố'.
  const type = kind && kind !== 'auto' && CATEGORIES[kind] ? kind : guessCategory(resolvedObjective || pickObjective(raw));
  const isText = Boolean(resolvedObjective || raw || cleanTitle);
  const confidence = type === 'unknown' ? 'thấp' : 'trung bình';
  const steps = isText ? [...COMMON_START, ...CATEGORY_STEPS[type]] : CATEGORY_STEPS.unknown;
  const query = [cleanTitle || resolvedObjective || raw.split('\n')[0] || '', 'Wuthering Waves quest walkthrough'].join(' ').trim().slice(0,200);
  return {
    title: cleanTitle || 'Nhiệm vụ chưa đặt tên',
    objective: resolvedObjective || 'Chưa trích được mục tiêu rõ ràng.',
    type, category: CATEGORIES[type], confidence,
    summary: type === 'unknown' ? 'Chưa đủ dữ liệu để xác định cách giải cụ thể.' : `Gợi ý quy trình chung cho nhóm “${CATEGORIES[type]}”; chưa xác nhận lời giải chính xác của nhiệm vụ này.`,
    steps, query, source: 'offline',
    warning: 'Đây là gợi ý theo loại nhiệm vụ, không phải hướng dẫn đã xác minh cho quest cụ thể.'
  };
}

export function guideLinks(query) {
  const q = String(query || 'Wuthering Waves walkthrough').trim().slice(0,230);
  return {
    web: `https://www.google.com/search?q=${encodeURIComponent(q)}`,
    video: `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
  };
}

export function progressPercent(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return 0;
  return Math.round(steps.filter(s => s.done).length / steps.length * 100);
}
