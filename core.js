'use strict';

const CampusCore = (() => {
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const shift = (date, n) => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const deadline = (lesson) => shift(lesson.date, lesson.days);

  const frequency = (db, studentId, courseId) => {
    const lessons = db.lessons.filter(
      (lesson) =>
        (!courseId || lesson.courseId === courseId) &&
        lesson.date <= today() &&
        Object.hasOwn(lesson.attendance, studentId)
    );
    const present = lessons.filter((lesson) => lesson.attendance[studentId]).length;
    const total = lessons.length;

    return {
      total,
      present,
      absent: total - present,
      percent: total ? Math.round((present / total) * 100) : null,
    };
  };

  const balance = (db, studentId) =>
    db.credits -
    db.requests.filter(
      (r) =>
        r.studentId === studentId &&
        r.type === 'Pessoal' &&
        ['Pendente', 'Aprovada'].includes(r.status)
    ).length;

  const absenceStatus = (db, lesson, studentId) => {
    const r = db.requests.find((r) => r.lessonId === lesson.id && r.studentId === studentId);
    if (r) return r.status;
    return today() > deadline(lesson) ? 'Prazo encerrado' : 'Aguardando envio';
  };

  const requestError = (db, data, id) => {
    const l = db.lessons.find((l) => l.id === data.lessonId);
    if (!l || l.attendance[data.studentId] !== false) return 'Selecione uma falta válida.';
    if (today() > deadline(l)) return 'O prazo para esta falta já encerrou.';
    if (db.requests.some((r) => r.id !== id && r.lessonId === data.lessonId && r.studentId === data.studentId)) {
      return 'Esta falta já tem uma justificativa.';
    }

    const old = db.requests.find((r) => r.id === id);
    const refundedCredit = old && old.type === 'Pessoal' && ['Pendente', 'Aprovada'].includes(old.status) ? 1 : 0;

    if (data.type === 'Pessoal' && balance(db, data.studentId) + refundedCredit < 1) {
      return 'Este aluno não tem créditos disponíveis.';
    }
    if (!data.reason.trim()) return 'Informe o motivo da ausência.';
    return '';
  };

  function seed() {
    const date = today();
    const db = {
      version: 3,
      credits: 6,
      groups: [
        { id: 'g1', name: 'Sistemas de Informação · 2º A', period: 'Noturno', semester: '2026.2' },
        { id: 'g2', name: 'Administração · 1º A', period: 'Matutino', semester: '2026.2' },
      ],
      students: [
        { id: 's1', name: 'Alexandre Bernades Queiroz', code: '2026001', email: 'alexandre@exemplo.invalid', groupId: 'g1' },
        { id: 's2', name: 'Pedro Aguiar Maia', code: '2026002', email: 'pedro@exemplo.invalid', groupId: 'g1' },
        { id: 's3', name: 'Luis Henrique Gonçalves Araújo', code: '2026003', email: 'luis.henrique@exemplo.invalid', groupId: 'g1' },
        { id: 's4', name: 'Kauan Soares Moura', code: '2026004', email: 'kauan@exemplo.invalid', groupId: 'g2' },
        { id: 's5', name: 'André Gustavo de Jesus Tavares', code: '2026005', email: 'andre.gustavo@exemplo.invalid', groupId: 'g2' },
        { id: 's6', name: 'Mariana Costa', code: '2026006', email: 'mariana.costa@exemplo.invalid', groupId: 'g1' },
        { id: 's7', name: 'Gabriel Santos', code: '2026007', email: 'gabriel.santos@exemplo.invalid', groupId: 'g1' },
        { id: 's8', name: 'Beatriz Oliveira', code: '2026008', email: 'beatriz.oliveira@exemplo.invalid', groupId: 'g1' },
        { id: 's9', name: 'Rafael Souza', code: '2026009', email: 'rafael.souza@exemplo.invalid', groupId: 'g2' },
        { id: 's10', name: 'Camila Rodrigues', code: '2026010', email: 'camila.rodrigues@exemplo.invalid', groupId: 'g2' },
        { id: 's11', name: 'João Pedro Lima', code: '2026011', email: 'joao.pedro@exemplo.invalid', groupId: 'g2' },
        { id: 's12', name: 'Isabela Almeida', code: '2026012', email: 'isabela.almeida@exemplo.invalid', groupId: 'g2' },
        { id: 's13', name: 'Pedro dos Santos Borges', code: '2026013', email: 'pedro.santos.borges@exemplo.invalid', groupId: 'g1' },
      ],
      courses: [
        { id: 'c1', name: 'Desenvolvimento Web', teacher: 'Mariana Almeida', groupId: 'g1', days: 3 },
        { id: 'c2', name: 'Banco de Dados', teacher: 'Rafael Mendes', groupId: 'g1', days: 5 },
        { id: 'c3', name: 'Engenharia de Software', teacher: 'Juliana Castro', groupId: 'g1', days: 3 },
        { id: 'c4', name: 'Fundamentos de Administração', teacher: 'Pedro Azevedo', groupId: 'g2', days: 3 },
      ],
      lessons: [],
      requests: [],
    };

    const topics = [
      'Apresentação e conceitos',
      'Atividade em grupo',
      'Aplicação prática',
      'Revisão e exercícios',
    ];

    db.courses.forEach((c, ci) => {
      for (let i = 0; i < 4; i++) {
        const attendance = {};
        db.students
          .filter((s) => s.groupId === c.groupId)
          .forEach((s, si) => {
            attendance[s.id] = !(i === 3 && (si === 0 || si === 1)) && !(i === 1 && si === 1 && ci === 0);
          });

        db.lessons.push({
          id: `l${ci}${i}`,
          courseId: c.id,
          date: shift(date, -(3 - i) * 7 - 1),
          topic: topics[i],
          days: c.days,
          attendance,
        });
      }
    });

    const pedro = db.students.find((s) => s.code === '2026013');
    db.lessons.forEach((lesson) => delete lesson.attendance[pedro.id]);
    const pedroLesson = db.lessons
      .filter((lesson) => lesson.courseId === 'c1')
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (pedroLesson) pedroLesson.attendance[pedro.id] = false;

    db.requests = [
      {
        id: 'r1',
        lessonId: 'l03',
        studentId: 's1',
        type: 'Documentada',
        reason: 'Consulta agendada no horário da aula. Solicito a análise da justificativa.',
        status: 'Pendente',
        createdAt: date,
        decision: '',
        attachment: null,
      },
      {
        id: 'r2',
        lessonId: 'l13',
        studentId: 's2',
        type: 'Pessoal',
        reason: 'Problema com o transporte no retorno do trabalho.',
        status: 'Pendente',
        createdAt: date,
        decision: '',
        attachment: null,
      },
      {
        id: 'r3',
        lessonId: 'l23',
        studentId: 's1',
        type: 'Pessoal',
        reason: 'Imprevisto familiar.',
        status: 'Aprovada',
        createdAt: date,
        decision: 'Justificativa acolhida para registro.',
        attachment: null,
      },
    ];

    return db;
  }

  return { today, shift, deadline, frequency, balance, absenceStatus, requestError, seed };
})();

if (typeof module !== 'undefined') module.exports = CampusCore;
