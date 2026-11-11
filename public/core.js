export const labels = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
export function normalize(value) {
  return String(value).normalize('NFKC').replace(/[澤随豫]/g, c => ({澤:'沢', 随:'隨', 豫:'予'}[c])).replace(/[\s　]/g, '').toLowerCase();
}
export function parseQuery(value) {
  let query = normalize(value), position = null;
  const m = query.match(/(?:[-:の]?([1-6初二三四五上])爻?|[六九]([二三四五]))$/);
  if (m && (query.endsWith('爻') || m[2] || /[-:の]/.test(m[0]) || /[^\d]/.test(query.slice(0, m.index)))) {
    position = ({初:1,二:2,三:3,四:4,五:5,上:6})[m[1] || m[2]] || Number(m[1]);
    query = query.slice(0, m.index);
  }
  return { query, position };
}
export function search(catalog, data, value) {
  const { query, position } = parseQuery(value);
  if (!query) return [];
  const direct = catalog.filter(g => normalize(g.name).includes(query) || String(g.id) === query || String(g.id).padStart(2,'0') === query);
  const results = direct.map(g => ({ id:g.id, position:position || 1, title:g.name + (position ? ' '+labels[position-1] : ''), excerpt:'第'+g.id+'卦 · '+g.upper+'／'+g.lower }));
  if (data) for (const g of data) {
    if (direct.some(d=>d.id===g.id)) continue;
    if (normalize(g.judgment).includes(query)) results.push({id:g.id,position:position||1,title:g.name+' · 卦辞',excerpt:g.judgment});
    for (const line of g.lines) if ((!position || position===line.position) && normalize(line.text+line.meaning).includes(query)) {
      results.push({id:g.id,position:line.position,title:g.name+' '+line.label,excerpt:line.text});
    }
  }
  return results.slice(0,40);
}
export function validData(data) {
  return Array.isArray(data) && data.length===64 && data.every((g,i)=>g.id===i+1 && typeof g.judgment==='string' && Array.isArray(g.lines) && g.lines.length===6 && g.lines.every((l,j)=>l.position===j+1 && typeof l.text==='string' && typeof l.meaning==='string' && Number.isInteger(l.hiddenId) && l.hiddenId>=1 && l.hiddenId<=64 && l.hiddenPosition>=1 && l.hiddenPosition<=6));
}
