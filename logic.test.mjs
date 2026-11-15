// Carga el <script> de index.html en un sandbox sin navegador y prueba la lógica de horas.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(c => c.includes("const STUDY_PLAN"));
const KEY = "alberto_study_plan_state_v2";

function load() {
  const store = {};
  const ctx = vm.createContext({
    console, Math, Date, JSON, Set, Object, Array, Number, String, setTimeout, clearTimeout,
    document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [] },
    window: {},
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => delete store[k] },
  });
  vm.runInContext(code + `
    renderApp = () => {}; showToast = () => {};
    globalThis.__t = { moveDebtToNextTask, undoMove, getTarget, getTaskData, findTaskById, sanitizeState,
      logSession, studyStats, loadState, saveState, generatePlan, validatePlanConfig, cleanCurriculum, curriculumToPlanSubjects, nextReviewDate, buildReviewQueue, cleanStudySessions, cleanStudyGoals, cleanFlashcards, flashcardNextDue, getDueFlashcards, rateFlashcard, parseGeneratedFlashcards, parseFlashcardCSV, cleanStudyDocuments, documentContextText, buildDocumentTutorTask, buildRecallGradingPrompt, parseRecallGrading, rankWeakTopics, buildWeeklyStudyPlan, moveWeeklyPlanItem, cleanAssessmentHistory, addAssessmentRecord, topicAssessmentSummary, cleanWeeklyAvailability, buildAcademicTrend, cleanTutorChat, getTutorChat, appendTutorChat, buildStudyDashboardModel };`, ctx);
  return { t: ctx.__t, store };
}

test("pulsar 'mover' dos veces no duplica las horas", () => {
  const { t } = load();
  t.getTaskData("d12nov_mates").loggedHours = 1;
  t.moveDebtToNextTask("d12nov_mates");
  t.moveDebtToNextTask("d12nov_mates");
  assert.equal(t.getTaskData("d13nov_mates").extraHours, 1);
  assert.equal(t.getTarget(t.findTaskById("d12nov_mates")), 1);
});

test("deshacer devuelve las horas a su sitio", () => {
  const { t } = load();
  t.getTaskData("d12nov_mates").loggedHours = 1;
  t.moveDebtToNextTask("d12nov_mates");
  t.undoMove("d12nov_mates");
  assert.equal(t.getTaskData("d13nov_mates").extraHours, 0);
  assert.equal(t.getTarget(t.findTaskById("d12nov_mates")), 2);
});

test("las horas pendientes nunca caen en un examen", () => {
  const { t } = load();
  t.getTaskData("d03dic_prog").loggedHours = 1;
  t.moveDebtToNextTask("d03dic_prog");
  assert.equal(t.getTaskData("d04dic_exam_prog").extraHours, 0);
});

test("sanitizeState descarta datos corruptos", () => {
  const { t } = load();
  assert.equal(t.sanitizeState([]), null);
  const clean = t.sanitizeState({ d12nov_mates: { loggedHours: "abc", extraHours: -3 }, inventado: { loggedHours: 1 } });
  assert.equal(JSON.stringify(clean), JSON.stringify({ d12nov_mates: { loggedHours: 0, extraHours: 0, moves: [] } }));
});

test("migra datos antiguos (v2) y guarda en formato v3", () => {
  const { t, store } = load();
  store[KEY] = JSON.stringify({ d12nov_mates: { loggedHours: 1.5, extraHours: 0 } });
  t.loadState();
  assert.equal(t.getTaskData("d12nov_mates").loggedHours, 1.5);
  t.saveState();
  assert.equal(JSON.parse(store[KEY]).v, 3);
});

test("el historial calcula la racha y las horas de la semana", () => {
  const { t } = load();
  t.logSession("d12nov_mates", 1);
  const st = t.studyStats();
  assert.equal(st.streak, 1);
  assert.equal(st.week, 1);
});

test("el plan generado respeta horas, fechas, exámenes y escapa el texto", () => {
  const { t } = load();
  const cfg = { start: "2026-11-02", subjects: [{ name: "Álgebra", exam: "2026-11-12", prio: 1 }, { name: "Física <b>", exam: "2026-11-16", prio: 3 }], hours: [0, 4, 4, 4, 4, 4, 2] };
  assert.equal(t.validatePlanConfig(cfg), null);
  const plan = t.generatePlan(cfg);
  const groups = plan.phases.flatMap(p => p.groups);
  groups.forEach(g => {
    const h = g.tasks.reduce((a, x) => a + x.hours, 0);
    assert.ok(h <= cfg.hours[new Date(g.date + "T00:00:00").getDay()]);
  });
  assert.equal(plan.examIds.length, 2);
  assert.equal(groups[groups.length - 1].date, "2026-11-16");
  assert.ok(!JSON.stringify(plan).includes("<b>"));
  assert.ok(t.validatePlanConfig({ ...cfg, hours: [0, 0, 0, 0, 0, 0, 0] }));
});


test("cleanCurriculum valida asignaturas y normaliza temas", () => {
  const { t } = load();
  const clean = t.cleanCurriculum([
    { id: "a1", name: "  Física  ", exam: "2026-12-10", color: "#123456", topics: [
      { id: "t1", name: "Cinemática", done: 1 },
      { id: "t2", name: "  ", done: false }
    ] },
    { name: "   " },
    { name: "Matemáticas", exam: "fecha-inválida", color: "rojo", topics: "no-es-array" }
  ]);
  assert.equal(clean.length, 2);
  assert.equal(clean[0].name, "Física");
  assert.equal(clean[0].topics.length, 1);
  assert.equal(clean[0].topics[0].done, true);
  assert.equal(clean[0].topics[0].mastery, 3);
  assert.equal(clean[0].topics[0].minutes, 60);
  assert.equal(clean[1].exam, "");
  assert.equal(clean[1].color, "#6366f1");
  assert.equal(clean[1].topics.length, 0);
});


test("importa al plan asignaturas con examen futuro sin truncar a seis", () => {
  const { t } = load();
  const subjects = [
    { name: "Matemáticas", exam: "2026-12-10" },
    { name: "Física", exam: "2026-12-12" },
    { name: "Sin fecha", exam: "" },
    { name: "Ya examinado", exam: "2026-11-01" },
    { name: "Programación", exam: "2026-12-15" },
    { name: "Historia", exam: "2026-12-16" },
    { name: "Química", exam: "2026-12-17" },
    { name: "Biología", exam: "2026-12-18" },
    { name: "Geografía", exam: "2026-12-19" },
    { name: "Historia del Arte", exam: "2026-12-20" }
  ];
  const result = t.curriculumToPlanSubjects(subjects, "2026-11-15");
  assert.equal(result.length, 8);
  assert.equal(result[0].name, "Matemáticas");
  assert.equal(result[0].prio, 2);
  assert.ok(result.every(s => s.exam > "2026-11-15"));
});

test("importa dominio y tiempo estimado de cada tema", () => {
  const { t } = load();
  const result = t.curriculumToPlanSubjects([{ name: "Física", exam: "2026-12-10", topics: [
    { name: "Cinemática", done: false, mastery: 1, minutes: 120 },
    { name: "Dinámica", done: false, mastery: 5, minutes: 45 },
    { name: "Energía", done: true, mastery: 2, minutes: 90 }
  ] }], "2026-11-15");
  assert.deepEqual(JSON.parse(JSON.stringify(result[0].topics)), [
    { name: "Cinemática", mastery: 1, minutes: 120, lastReviewed: "" },
    { name: "Dinámica", mastery: 5, minutes: 45, lastReviewed: "" }
  ]);
});

test("el plan conserva la información de dominio y tiempo en la descripción de cada bloque", () => {
  const { t } = load();
  const plan = t.generatePlan({ start: "2026-11-02", subjects: [{ name: "Física", exam: "2026-11-05", prio: 2, topics: [{ name: "Cinemática", mastery: 1, minutes: 120 }] }], hours: [0, 4, 4, 4, 4, 4, 2] });
  const tasks = plan.phases.flatMap(p => p.groups).flatMap(g => g.tasks);
  const topicTask = tasks.find(task => task.title === "Física: Cinemática");
  assert.ok(topicTask);
  assert.match(topicTask.desc, /Dominio registrado: 1\/5/);
  assert.match(topicTask.desc, /120 minutos/);
});


test("el plan admite más de seis asignaturas hasta el límite de seguridad", () => {
  const { t } = load();
  const subjects = Array.from({ length: 8 }, (_, i) => ({ name: `Asignatura ${i + 1}`, exam: `2026-12-${String(10 + i).padStart(2, "0")}`, prio: 2 }));
  assert.equal(t.validatePlanConfig({ start: "2026-11-15", subjects, hours: [0, 3, 3, 3, 3, 3, 3] }), null);
  assert.ok(t.validatePlanConfig({ start: "2026-11-15", subjects: [...subjects, ...subjects, ...subjects], hours: [0, 3, 3, 3, 3, 3, 3] }));
});

test("los temas pendientes se convierten en bloques concretos del plan", () => {
  const { t } = load();
  const cfg = { start: "2026-11-02", subjects: [{ name: "Física", exam: "2026-11-05", prio: 2, topics: ["Cinemática", "Dinámica"] }], hours: [0, 4, 4, 4, 4, 4, 2] };
  const plan = t.generatePlan(cfg);
  const tasks = plan.phases.flatMap(p => p.groups).flatMap(g => g.tasks).filter(task => task.subject === "s1" && task.hours > 0);
  assert.ok(tasks.some(task => task.title === "Física: Cinemática"));
  assert.ok(tasks.some(task => task.title === "Física: Dinámica"));
  assert.ok(tasks.every(task => task.desc.includes("tema")));
});


test("el repaso espaciado calcula intervalos según dominio", () => {
  const { t } = load();
  assert.equal(t.nextReviewDate("2026-11-15", 1), "2026-11-16");
  assert.equal(t.nextReviewDate("2026-11-15", 3), "2026-11-19");
  assert.equal(t.nextReviewDate("2026-11-15", 5), "2026-11-29");
});

test("la cola de repaso incluye temas pendientes vencidos y ordena los atrasados primero", () => {
  const { t } = load();
  const today = new Date(2026, 10, 15);
  const queue = t.buildReviewQueue([{ id: "s", name: "Física", topics: [
    { id: "a", name: "Dinámica", done: false, mastery: 1, nextReview: "2026-11-10" },
    { id: "b", name: "Óptica", done: false, mastery: 4, nextReview: "2026-11-15" },
    { id: "c", name: "Ondas", done: false, mastery: 3, nextReview: "2026-11-20" },
    { id: "d", name: "Termodinámica", done: true, mastery: 1, nextReview: "2026-11-10" }
  ] }], today);
  assert.deepEqual(queue.map(x => x.topic), ["Dinámica", "Óptica"]);
  assert.equal(queue[0].overdueDays, 5);
});

test("cleanStudySessions conserva sesiones manuales y descarta registros inválidos", () => {
  const { t } = load();
  const clean = t.cleanStudySessions([
    { id: "m1", date: "2026-11-15", minutes: 90, subjectId: "s1", note: "Repaso", source: "manual" },
    { date: "2026-11-15", minutes: 600 },
    { date: "2026-02-30", minutes: 30 },
    { date: "2026-11-15", minutes: 601 },
    null
  ]);
  assert.equal(clean.length, 2);
  assert.equal(clean[0].source, "manual");
  assert.equal(clean[0].note, "Repaso");
  assert.equal(clean[1].minutes, 600);
});

test("cleanStudyGoals aplica límites seguros y valores por defecto", () => {
  const { t } = load();
  assert.deepEqual(JSON.parse(JSON.stringify(t.cleanStudyGoals({ dailyMinutes: 9999, weeklyHours: -2 }))), { dailyMinutes: 720, weeklyHours: 1 });
  assert.deepEqual(JSON.parse(JSON.stringify(t.cleanStudyGoals({ dailyMinutes: "abc" }))), { dailyMinutes: 120, weeklyHours: 14 });
});


test("flashcards valida y limita los datos importados", () => {
  const { t } = load();
  const cards = t.cleanFlashcards([
    { id: "a", subjectId: "s1", front: " ¿Qué es una integral? ", back: "Área acumulada", due: "2026-11-15", reps: 2 },
    { front: "", back: "sin pregunta" }, null,
    { front: "Pregunta", back: "Respuesta", due: "fecha-inválida" }
  ]);
  assert.equal(cards.length, 2);
  assert.equal(cards[0].front, "¿Qué es una integral?");
  assert.equal(cards[1].due, "2026-11-15");
});

test("el repaso de flashcards programa intervalos según la autoevaluación", () => {
  const { t } = load();
  assert.equal(t.flashcardNextDue({}, 1, new Date(2026, 10, 15)), "2026-11-16");
  assert.equal(t.flashcardNextDue({}, 3, new Date(2026, 10, 15)), "2026-11-18");
  assert.equal(t.flashcardNextDue({}, 5, new Date(2026, 10, 15)), "2026-11-29");
});

test("la cola de flashcards solo incluye tarjetas vencidas y rateFlashcard actualiza su próxima fecha", () => {
  const { t } = load();
  const cards = t.cleanFlashcards([
    { id: "a", front: "A", back: "Respuesta A", due: "2026-11-10" },
    { id: "b", front: "B", back: "Respuesta B", due: "2026-11-20" }
  ]);
  assert.deepEqual(t.getDueFlashcards(cards, new Date(2026, 10, 15)).map(c => c.id), ["a"]);
  t.rateFlashcard(cards[0], 4, new Date(2026, 10, 15));
  assert.equal(cards[0].due, "2026-11-22");
  assert.equal(cards[0].reps, 1);
});


test("parseGeneratedFlashcards acepta JSON de IA y descarta tarjetas incompletas", () => {
  const { t } = load();
  const cards = t.parseGeneratedFlashcards('```json\n{"flashcards":[{"front":"¿Qué es X?","back":"Una definición"},{"front":"Sin respuesta"}]}\n```', "s1", new Date(2026, 10, 15));
  assert.equal(cards.length, 1);
  assert.equal(cards[0].subjectId, "s1");
  assert.equal(cards[0].due, "2026-11-15");
});

test("parseFlashcardCSV importa columnas front y back con comillas y comas", () => {
  const { t } = load();
  const rows = t.parseFlashcardCSV('subject,front,back\r\n"Física","¿Qué es fuerza?","Magnitud, vectorial"');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].subjectName, "Física");
  assert.equal(rows[0].back, "Magnitud, vectorial");
});


test("cleanStudyDocuments valida, limita y normaliza la biblioteca", () => {
  const { t } = load();
  const docs = t.cleanStudyDocuments([
    { id: "d1", name: " Apuntes.pdf ", type: "pdf", subjectId: "s1", text: "Contenido de prueba", pages: 12, createdAt: "2026-11-15" },
    { name: "", text: "no válido" }, null,
    { name: "Notas", type: "exe", text: "Texto" }
  ]);
  assert.equal(docs.length, 2);
  assert.equal(docs[0].name, "Apuntes.pdf");
  assert.equal(docs[0].pages, 12);
  assert.equal(docs[1].type, "txt");
});

test("documentContextText limita el contexto y conserva principio y final", () => {
  const { t } = load();
  const text = "A".repeat(100) + "B".repeat(100) + "C".repeat(100);
  const context = t.documentContextText({ text }, 100);
  assert.ok(context.length < 170);
  assert.ok(context.startsWith("A"));
  assert.ok(context.endsWith("C"));
  assert.match(context, /omitido por límite/);
});


test("el tutor contextual ofrece modos diferenciados y mantiene el límite documental", () => {
  const { t } = load();
  const exam = t.buildDocumentTutorTask("exam", "fotosíntesis");
  const quiz = t.buildDocumentTutorTask("quiz", "clorofila");
  const explain = t.buildDocumentTutorTask("explain", "fase luminosa");
  assert.match(exam, /8 preguntas de examen/);
  assert.match(exam, /fotosíntesis/);
  assert.match(quiz, /cuatro opciones/);
  assert.match(explain, /paso a paso/);
  assert.match(t.buildDocumentTutorTask("desconocido", "duda"), /exclusivamente el documento/);
});

test("el tutor contextual limita y limpia el tema introducido", () => {
  const { t } = load();
  const task = t.buildDocumentTutorTask("outline", "  " + "X".repeat(1500));
  assert.ok(task.length < 1400);
  assert.ok(task.includes("X".repeat(1200)));
});


test("el prompt de corrección utiliza respuestas y apuntes aportados, con límites de tamaño", () => {
  const { t } = load();
  const prompt = t.buildRecallGradingPrompt([{ subject: "Física", topic: "Dinámica", answer: "La fuerza es...", source: "Apuntes de Newton".repeat(2000) }]);
  assert.match(prompt, /Física/);
  assert.match(prompt, /La fuerza es/);
  assert.ok(prompt.length < 12000);
  assert.match(prompt, /exclusivamente las fuentes/);
});

test("parseRecallGrading valida puntuaciones, veredictos y limita el resultado", () => {
  const { t } = load();
  const grades = t.parseRecallGrading('```json\n{"results":[{"index":1,"score":12,"verdict":"correcta","feedback":"Bien","missing":[]},{"index":2,"score":-2,"verdict":"inventado","feedback":"Revisar","missing":["Concepto"]}]}\n```', 2);
  assert.equal(grades.length, 2);
  assert.equal(grades[0].score, 10);
  assert.equal(grades[0].verdict, "correcta");
  assert.equal(grades[1].score, 0);
  assert.equal(grades[1].verdict, "no_evaluable");
});


test("rankWeakTopics prioriza repasos vencidos y menor dominio", () => {
  const { t } = load();
  const subjects = [{id:"s1",name:"Física",topics:[
    {id:"a",name:"Tema A",done:false,mastery:4,nextReview:"2026-11-14"},
    {id:"b",name:"Tema B",done:false,mastery:1,nextReview:"2026-11-16"},
    {id:"c",name:"Tema C",done:true,mastery:1,nextReview:"2026-11-01"}
  ]}];
  const ranked=t.rankWeakTopics(subjects,"2026-11-15");
  assert.deepEqual(ranked.map(x=>x.topicId),["a","b"]);
});

test("buildWeeklyStudyPlan distribuye temas pendientes en siete días", () => {
  const { t } = load();
  const subjects=[{id:"s1",name:"Mates",topics:Array.from({length:9},(_,i)=>({id:`t${i}`,name:`Tema ${i}`,done:false,mastery:2,nextReview:"2026-11-15"}))}];
  const plan=t.buildWeeklyStudyPlan(subjects,"2026-11-16",120);
  assert.equal(plan.length,7);
  assert.equal(plan.reduce((n,d)=>n+d.items.length,0),9);
});

test("moveWeeklyPlanItem cambia una sesión de día sin duplicarla", () => {
  const { t } = load();
  const plan=[{date:"2026-11-16",items:[{id:"x",title:"Álgebra"}]},{date:"2026-11-17",items:[]}];
  t.moveWeeklyPlanItem(plan,"x","2026-11-17");
  assert.equal(plan[0].items.length,0);
  assert.equal(plan[1].items[0].id,"x");
});

test("el modo socrático guía con una pregunta sin revelar la solución", () => {
  const { t } = load();
  const prompt=t.buildDocumentTutorTask("socratic","derivadas");
  assert.match(prompt,/UNA pregunta cada vez/);
  assert.match(prompt,/exclusivamente el documento/);
});

test("el historial de evaluaciones limpia, limita y conserva la procedencia", () => {
  const { t } = load();
  const history = t.cleanAssessmentHistory([
    { id: "a", date: "2026-11-15", subjectId: "s", topicId: "t", score: 8.26, source: "ai", verdict: "correcta", feedback: "Bien" },
    { date: "fecha-mala", subjectId: "s", topicId: "t", score: 7 },
    { date: "2026-11-15", subjectId: "s", topicId: "t", score: 99, source: "otra" }
  ]);
  assert.equal(history.length, 2);
  assert.equal(history[0].score, 8.3);
  assert.equal(history[0].source, "ai");
  assert.equal(history[1].score, 10);
  assert.equal(history[1].source, "self");
});

test("las evaluaciones recientes se resumen por tema y alimentan la prioridad", () => {
  const { t } = load();
  const subjects = [{ id: "s", name: "Física", topics: [
    { id: "a", name: "Tema A", done: false, mastery: 3, nextReview: "2026-11-16" },
    { id: "b", name: "Tema B", done: false, mastery: 3, nextReview: "2026-11-16" }
  ] }];
  const history = [
    { date: "2026-11-14", subjectId: "s", topicId: "a", subject: "Física", topic: "Tema A", score: 2, source: "ai" },
    { date: "2026-11-15", subjectId: "s", topicId: "a", subject: "Física", topic: "Tema A", score: 3, source: "self" },
    { date: "2026-11-15", subjectId: "s", topicId: "b", subject: "Física", topic: "Tema B", score: 9, source: "ai" }
  ];
  const summary = t.topicAssessmentSummary(history, "s", "a");
  assert.equal(summary.average, 2.5);
  assert.equal(summary.count, 2);
  assert.equal(summary.last, "2026-11-15");
  const ranked = t.rankWeakTopics(subjects, "2026-11-15", history);
  assert.equal(ranked[0].topicId, "a");
  assert.equal(ranked[0].assessmentAvg, 2.5);
});

test("el plan semanal amplía el tiempo de temas con resultados bajos", () => {
  const { t } = load();
  const subjects = [{ id: "s", name: "Química", topics: [
    { id: "a", name: "Enlaces", done: false, mastery: 3, nextReview: "2026-11-16" }
  ] }];
  const baseline = t.buildWeeklyStudyPlan(subjects, "2026-11-16", 120, []);
  const assessed = t.buildWeeklyStudyPlan(subjects, "2026-11-16", 120, [
    { date: "2026-11-15", subjectId: "s", topicId: "a", subject: "Química", topic: "Enlaces", score: 3, source: "ai" }
  ]);
  assert.equal(assessed[0].items[0].minutes, baseline[0].items[0].minutes + 15);
  assert.equal(assessed[0].items[0].assessmentAvg, 3);
});

test("addAssessmentRecord añade una evaluación sin mutar el historial original", () => {
  const { t } = load();
  const original = [];
  const next = t.addAssessmentRecord(original, { subjectId: "s", subject: "Mates", topicId: "t", topic: "Derivadas" }, 7.5, "ai", "2026-11-15", { verdict: "parcial" });
  assert.equal(original.length, 0);
  assert.equal(next.length, 1);
  assert.equal(next[0].score, 7.5);
  assert.equal(next[0].source, "ai");
});

test("las sesiones Focus quedan vinculadas al tema y se conservan al limpiar", () => {
  const { t } = load();
  const sessions = t.cleanStudySessions([{ id: "f1", date: "2026-11-15", minutes: 45, subjectId: "s", topicId: "t", note: "Derivadas", source: "focus" }]);
  assert.equal(sessions[0].topicId, "t");
  assert.equal(sessions[0].note, "Derivadas");
});

test("la actividad Focus reciente reduce la prioridad de un tema ya practicado", () => {
  const { t } = load();
  const subjects = [{ id: "s", name: "Mates", topics: [
    { id: "a", name: "Integrales", done: false, mastery: 3, nextReview: "2026-11-20" },
    { id: "b", name: "Derivadas", done: false, mastery: 3, nextReview: "2026-11-20" }
  ] }];
  const sessions = [{ id: "f", date: "2026-11-15", minutes: 60, subjectId: "s", topicId: "a", source: "focus" }];
  const ranked = t.rankWeakTopics(subjects, "2026-11-15", [], sessions);
  assert.equal(ranked[0].topicId, "b");
  assert.equal(ranked.find(x => x.topicId === "a").recentStudyMinutes, 60);
});


test("la disponibilidad semanal limita minutos y normaliza duración de sesión", () => {
  const { t } = load();
  const cfg = t.cleanWeeklyAvailability({ days: [-10, 60, 9999, "x"], sessionMinutes: 500 });
  assert.deepEqual(JSON.parse(JSON.stringify(cfg)), { days: [0, 60, 720, 120, 120, 120, 120], sessionMinutes: 180 });
});

test("el plan semanal respeta la disponibilidad del día y duración máxima", () => {
  const { t } = load();
  const subjects = [{ id: "s", name: "Física", topics: Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, name: `Tema ${i}`, done: false, mastery: 1, minutes: 120, nextReview: "2026-11-16" })) }];
  const plan = t.buildWeeklyStudyPlan(subjects, "2026-11-16", 120, [], [], { days: [60, 0, 0, 0, 0, 0, 0], sessionMinutes: 45 });
  assert.equal(plan[0].items.reduce((n, x) => n + x.minutes, 0), 45);
  assert.ok(plan.slice(1).every(day => day.items.length === 0));
  assert.ok(plan.every(day => day.items.every(item => item.minutes <= 45)));
});

test("el planificador reparte temas en los días que tienen disponibilidad", () => {
  const { t } = load();
  const subjects = [{ id: "s", name: "Mates", topics: Array.from({ length: 4 }, (_, i) => ({ id: `t${i}`, name: `Tema ${i}`, done: false, mastery: 2, minutes: 60, nextReview: "2026-11-16" })) }];
  const plan = t.buildWeeklyStudyPlan(subjects, "2026-11-16", 120, [], [], { days: [50, 0, 50, 0, 50, 0, 0], sessionMinutes: 50 });
  assert.ok(plan[0].items.length + plan[2].items.length + plan[4].items.length > 0);
  assert.equal(plan[1].items.length + plan[3].items.length + plan[5].items.length + plan[6].items.length, 0);
});

test("el historial del tutor conserva turnos válidos y limita su tamaño", () => {
  const { t } = load();
  const rows = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "model" : "user", text: `Mensaje ${i}`, at: "2026-11-15" }));
  const clean = t.cleanTutorChat([...rows, { role: "system", text: "No guardar" }, { role: "user", text: "  " }]);
  assert.equal(clean.length, 24);
  assert.equal(clean[0].text, "Mensaje 6");
  assert.equal(clean.at(-1).text, "Mensaje 29");
});

test("appendTutorChat no muta el historial previo y mantiene chats separados por documento", () => {
  const { t } = load();
  const original = { docA: [{ role: "user", text: "Hola" }] };
  const next = t.appendTutorChat(original, "docA", "model", "Respuesta");
  const other = t.appendTutorChat(next, "docB", "user", "Otra duda");
  assert.equal(original.docA.length, 1);
  assert.equal(t.getTutorChat("docA", other).length, 2);
  assert.equal(t.getTutorChat("docB", other)[0].text, "Otra duda");
});

test("la evolución académica agrupa horas y notas por semana", () => {
  const { t } = load();
  const trend = t.buildAcademicTrend([
    { date: "2026-11-09", subjectId: "s", topicId: "t", score: 8, source: "ai" },
    { date: "2026-11-10", subjectId: "s", topicId: "t", score: 6, source: "self" }
  ], [{ date: "2026-11-09", minutes: 90 }, { date: "2026-11-12", minutes: 30 }], "2026-11-15");
  assert.equal(trend.length, 6);
  const week = trend.find(x => x.start === "2026-11-09");
  assert.equal(week.minutes, 120);
  assert.equal(week.assessments, 2);
  assert.equal(week.average, 7);
});

test("el panel de estudio integra horas, repasos, flashcards, notas y próximos exámenes", () => {
  const { t } = load();
  const today = "2026-11-15";
  const subjects = [{ id:"s1", name:"Matemáticas", exam:"2026-11-20", topics:[
    { id:"t1", name:"Matrices", mastery:2, done:false, nextReview:"2026-11-14", minutes:60 },
    { id:"t2", name:"Vectores", mastery:4, done:true, nextReview:"2026-11-30", minutes:45 }
  ] }];
  const sessions = [{ id:"f1", date:today, minutes:50, subjectId:"s1", topicId:"t1", source:"focus" }];
  const history = [{ id:"a1", date:today, subjectId:"s1", topicId:"t1", score:6, source:"ai" }];
  const cards = [{ id:"c1", front:"Pregunta", back:"Respuesta", due:today }];
  const model = t.buildStudyDashboardModel(subjects, history, sessions, cards, today);
  assert.equal(model.todayMinutes, 50);
  assert.equal(model.pendingTopics, 1);
  assert.equal(model.completedTopics, 1);
  assert.equal(model.reviewCount, 1);
  assert.equal(model.dueCards, 1);
  assert.equal(model.gradeAverage, 6);
  assert.equal(model.nextExam.days, 5);
  assert.equal(model.recommendation.kind, "review");
});

test("el panel no inventa medias ni exámenes cuando no hay datos", () => {
  const { t } = load();
  const model = t.buildStudyDashboardModel([], [], [], [], "2026-11-15");
  assert.equal(model.gradeAverage, null);
  assert.equal(model.nextExam, null);
  assert.equal(model.pendingTopics, 0);
  assert.equal(model.recommendation.kind, "subjects");
});
