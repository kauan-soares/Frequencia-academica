'use strict';

const C = CampusCore;
const KEY = 'campus-frequency-v3';

let db;
try {
  db = JSON.parse(localStorage.getItem(KEY)) || C.seed();
  if (db.version !== 3) throw Error();
} catch {
  db = C.seed();
}

function ensurePedroDemoRecord() {
  let changed = false;
  let student = db.students.find(
    (s) => s.name.toLocaleLowerCase('pt-BR') === 'pedro dos santos borges' || s.code === '2026013'
  );
  if (!student) {
    student = {
      id: 's13',
      name: 'Pedro dos Santos Borges',
      code: '2026013',
      email: 'pedro.santos.borges@exemplo.invalid',
      groupId: db.groups.find((g) => g.id === 'g1')?.id || db.groups[0]?.id,
    };
    db.students.push(student);
    changed = true;
  } else {
    if (student.name !== 'Pedro dos Santos Borges') { student.name = 'Pedro dos Santos Borges'; changed = true; }
    if (!student.code) { student.code = '2026013'; changed = true; }
  }

  // Dados demonstrativos: metade das aulas com presença e metade com falta.
  // Em 4 aulas por disciplina, isso resulta em 50% de frequência.
  const lessonsByCourse = new Map();
  db.lessons
    .filter((lesson) =>
      db.courses.some((course) => course.id === lesson.courseId && course.groupId === student.groupId)
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((lesson) => {
      if (!lessonsByCourse.has(lesson.courseId)) lessonsByCourse.set(lesson.courseId, []);
      lessonsByCourse.get(lesson.courseId).push(lesson);
    });

  lessonsByCourse.forEach((lessons) => {
    lessons.forEach((lesson, index) => {
      const present = index < Math.ceil(lessons.length / 2);
      if (lesson.attendance[student.id] !== present) {
        lesson.attendance[student.id] = present;
        changed = true;
      }
    });
  });

  if (changed) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
  }
}
ensurePedroDemoRecord();

let page = 'painel';
let query = '';
let filter = '';
let toastTimer;

const $ = (s) => document.querySelector(s);

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));

const icons = {
  painel: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  alunos: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v2"/>',
  turmas: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10M15 10v10"/>',
  disciplinas: '<path d="M12 5c-3-2-7-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-6-1-9 1Zm0 0v15"/>',
  chamada: '<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 2v4m8-4v4M8 13l3 3 5-6"/>',
  justificativas: '<path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h8m-8 4h5"/>',
  relatorios: '<path d="M4 3v18h17M8 17v-5m5 5V7m5 10V4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
};

const icon = (n) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[n] || icons.painel}</svg>`;

const names = {
  painel: 'Visão geral',
  alunos: 'Alunos',
  turmas: 'Turmas',
  disciplinas: 'Disciplinas',
  chamada: 'Diário de frequência',
  justificativas: 'Justificativas',
  relatorios: 'Relatórios',
};

const find = (type, id) => db[type].find((x) => x.id === id);
const name = (type, id) => find(type, id)?.name || '—';
const initials = (n) => n.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('');
const date = (d) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—');
const uid = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);

function toast(msg) {
  $('#toast').textContent = msg;
  $('#toast').style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('#toast').style.display = 'none'), 4500);
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
    return true;
  } catch {
    toast('Não foi possível salvar. Verifique o espaço do navegador ou reduza o anexo.');
    return false;
  }
}

function commit(change) {
  const before = JSON.stringify(db);
  change();
  if (!persist()) {
    db = JSON.parse(before);
    return false;
  }
  render();
  return true;
}

const button = (text, action, id = '', style = 'secondary small') =>
  `<button class="button ${style}" data-action="${action}" data-id="${esc(id)}">${text}</button>`;

const badge = (text) => {
  const tone = ['Aprovada', 'Presente', 'Regular'].includes(text)
    ? 'green'
    : ['Pendente', 'Aguardando envio', 'Atenção'].includes(text)
      ? 'amber'
      : ['Recusada', 'Prazo encerrado', 'Falta', 'Baixa frequência'].includes(text)
        ? 'red'
        : '';
  return `<span class="badge ${tone}">${esc(text)}</span>`;
};

function head(title, description, action, label) {
  return `
    <div class="page-head">
      <div>
        <span class="eyebrow">GESTÃO DE FREQUÊNCIA ACADÊMICA</span>
        <h1>${title}</h1>
        <p>${description}</p>
      </div>
      ${action ? button(icon('plus') + label, action, '', '') : ''}
    </div>`;
}

const empty = (text = 'Nenhum registro encontrado.', detail = 'Cadastre um novo registro ou ajuste a busca.') =>
  `<div class="empty"><strong>${text}</strong>${detail}</div>`;

function table(headers, rows) {
  return `
    <div class="panel">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>${headers.map((x) => `<th>${x}</th>`).join('')}</tr>
          </thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>
      ${rows.length ? `<div class="table-footer">${rows.length} registro${rows.length === 1 ? '' : 's'} exibido${rows.length === 1 ? '' : 's'}</div>` : empty()}
    </div>`;
}

function toolbar(placeholder, options = '') {
  return `
    <div class="toolbar">
      <div class="search">
        <input id="search" aria-label="Buscar" placeholder="${placeholder}" value="${esc(query)}">
      </div>
      ${options ? `<select id="filter" aria-label="Filtrar">${options}</select>` : ''}
    </div>`;
}

const opts = (list, selected = '', blank = 'Selecione') =>
  `<option value="">${blank}</option>` +
  list.map((x) => `<option value="${esc(x.id)}" ${x.id === selected ? 'selected' : ''}>${esc(x.name)}</option>`).join('');

const groupFilter = () => opts(db.groups, filter, 'Todas as turmas');
const matches = (text) => text.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'));

function frequencyAll(courseId) {
  let present = 0;
  let total = 0;
  db.students.forEach((s) => {
    const f = C.frequency(db, s.id, courseId);
    present += f.present;
    total += f.total;
  });
  return total ? Math.round((present / total) * 100) : null;
}

const percent = (v) => (v === null ? '—' : v + '%');

function dashboard() {
  const pending = db.requests.filter((r) => r.status === 'Pendente');
  const risk = db.students.filter((s) => {
    const pct = C.frequency(db, s.id).percent;
    return pct !== null && pct < 75;
  });

  const statsData = [
    [db.students.length, 'Alunos matriculados', 'alunos', `${db.groups.length} turmas cadastradas`],
    [percent(frequencyAll()), 'Frequência geral', 'relatorios', 'Sobre as aulas registradas'],
    [pending.length, 'Justificativas pendentes', 'justificativas', 'Aguardando análise'],
    [risk.length, 'Alunos em atenção', 'alunos', 'Frequência abaixo de 75%'],
  ];

  return (
    head('Um olhar sobre a presença.', 'Acompanhe as turmas e cuide de quem precisa de atenção.', 'new-lesson', 'Registrar chamada') +
    `<section class="hero">
      <div>
        <span class="eyebrow">CADA PRESENÇA CONTA</span>
        <h2>Mais acompanhamento. Menos distância.</h2>
        <p>Alunos, aulas e justificativas em um só lugar. Transforme os registros de frequência em uma rotina de cuidado acadêmico.</p>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="hero-sheet">
          <b>✓  ✓</b>
          <span></span>
          <span style="width:70%"></span>
        </div>
      </div>
    </section>

    <section class="stats">
      ${statsData
        .map(
          ([n, l, i, s]) => `
        <div class="stat">
          <div class="stat-top">${l}<span class="stat-icon">${icon(i)}</span></div>
          <strong>${n}</strong>
          <small>${s}</small>
        </div>`
        )
        .join('')}
    </section>

    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>Frequência por disciplina</h2>
            <p>Presenças sobre o total de registros</p>
          </div>
          <a class="text-link" target="_self" href="#relatorios">Ver relatório ↗</a>
        </div>
        <div class="panel-body">
          ${
            db.courses.length
              ? db.courses
                  .map((c, i) => {
                    const f = frequencyAll(c.id);
                    return `
              <div class="course-row">
                <div class="course-icon">${String(i + 1).padStart(2, '0')}</div>
                <div>
                  <h3>${esc(c.name)}</h3>
                  <small>${esc(name('groups', c.groupId))}</small>
                  <div class="progress ${f !== null && f < 75 ? 'low' : ''}">
                    <span style="width:${f ?? 0}%"></span>
                  </div>
                </div>
                <b>${percent(f)}</b>
              </div>`;
                  })
                  .join('')
              : empty('Sem disciplinas cadastradas.')
          }
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>Caixa de justificativas</h2>
            <p>Um espaço para ouvir o aluno</p>
          </div>
          <span class="badge amber">${pending.length} pendentes</span>
        </div>
        <div class="panel-body">
          ${
            pending.length
              ? pending
                  .slice(0, 3)
                  .map((r) => {
                    const s = find('students', r.studentId);
                    const l = find('lessons', r.lessonId);
                    return `
              <div class="request-item">
                <span class="initials">${esc(initials(s.name))}</span>
                <div>
                  <h3>${esc(s.name)}</h3>
                  <p>${esc(name('courses', l.courseId))}<br>${date(l.date)} · ${esc(r.type)}</p>
                  ${button('Analisar pedido →', 'review', r.id)}
                </div>
              </div>`;
                  })
                  .join('')
              : empty('Tudo em dia.', 'Não há justificativas aguardando análise.')
          }
        </div>
      </section>
    </div>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>Alunos que precisam de atenção</h2>
          <p>Indicador demonstrativo de acompanhamento: abaixo de 75%</p>
        </div>
        <a target="_self" href="#relatorios" class="text-link">Ver todos ↗</a>
      </div>
      ${
        risk.length
          ? `<div class="table-wrap">
              <table>
                <thead>
                  <tr><th>ALUNO</th><th>TURMA</th><th>FREQUÊNCIA</th><th>SITUAÇÃO</th></tr>
                </thead>
                <tbody>
                  ${risk
                    .map(
                      (s) => `
                    <tr>
                      <td><strong>${esc(s.name)}</strong><small>${esc(s.code)}</small></td>
                      <td>${esc(name('groups', s.groupId))}</td>
                      <td>${percent(C.frequency(db, s.id).percent)}</td>
                      <td>${badge('Atenção')}</td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>`
          : empty('Nenhum alerta de frequência.', 'Os alunos com registros estão acima do indicador de atenção.')
      }
    </section>`
  );
}

function students() {
  const list = db.students.filter(
    (s) => (!filter || s.groupId === filter) && matches(s.name + ' ' + s.code + ' ' + s.email)
  );

  return (
    head('Alunos', 'Organize os cadastros e acompanhe cada trajetória.', 'new-student', 'Cadastrar aluno') +
    toolbar('Buscar por nome, matrícula ou e-mail...', groupFilter()) +
    table(
      ['ALUNO / MATRÍCULA', 'TURMA', 'FREQUÊNCIA', 'AÇÕES'],
      list.map(
        (s) => `
        <tr>
          <td>
            <div class="name-cell">
              <span class="initials">${esc(initials(s.name))}</span>
              <div>
                <strong>${esc(s.name)}</strong>
                <small>${esc(s.code)} · ${esc(s.email)}</small>
              </div>
            </div>
          </td>
          <td>${esc(name('groups', s.groupId))}</td>
          <td class="numeric">${percent(C.frequency(db, s.id).percent)}</td>
          <td>
            <div class="actions">
              ${button('Editar', 'edit-student', s.id)}
              ${button('Excluir', 'delete-student', s.id, 'danger small')}
            </div>
          </td>
        </tr>`
      )
    )
  );
}

function groups() {
  return (
    head('Turmas', 'O ponto de encontro entre alunos e disciplinas.', 'new-group', 'Criar turma') +
    toolbar('Buscar turma...') +
    table(
      ['TURMA', 'TURNO / SEMESTRE', 'ALUNOS', 'AÇÕES'],
      db.groups
        .filter((g) => matches(g.name))
        .map(
          (g) => `
        <tr>
          <td><strong>${esc(g.name)}</strong></td>
          <td>${esc(g.period)}<small>${esc(g.semester)}</small></td>
          <td>${db.students.filter((s) => s.groupId === g.id).length}</td>
          <td>
            <div class="actions">
              ${button('Editar', 'edit-group', g.id)}
              ${button('Excluir', 'delete-group', g.id, 'danger small')}
            </div>
          </td>
        </tr>`
        )
    )
  );
}

function courses() {
  return (
    head('Disciplinas', 'Defina professores, turmas e prazos de justificativa.', 'new-course', 'Nova disciplina') +
    toolbar('Buscar disciplina ou professor...', groupFilter()) +
    table(
      ['DISCIPLINA', 'TURMA', 'PROFESSOR', 'PRAZO', 'AÇÕES'],
      db.courses
        .filter((c) => (!filter || c.groupId === filter) && matches(c.name + ' ' + c.teacher))
        .map(
          (c) => `
        <tr>
          <td><strong>${esc(c.name)}</strong></td>
          <td>${esc(name('groups', c.groupId))}</td>
          <td>${esc(c.teacher)}</td>
          <td>${c.days} dias corridos</td>
          <td>
            <div class="actions">
              ${button('Editar', 'edit-course', c.id)}
              ${button('Excluir', 'delete-course', c.id, 'danger small')}
            </div>
          </td>
        </tr>`
        )
    )
  );
}

function lessons() {
  const sorted = [...db.lessons]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((l) => (!filter || l.courseId === filter) && matches(name('courses', l.courseId) + ' ' + l.topic));

  return (
    head('Diário de frequência', 'Registre a chamada e consulte o histórico das aulas.', 'new-lesson', 'Registrar chamada') +
    toolbar('Buscar disciplina ou conteúdo...', opts(db.courses, filter, 'Todas as disciplinas')) +
    table(
      ['DATA / DISCIPLINA', 'CONTEÚDO', 'PRESENÇAS', 'FALTAS', 'AÇÕES'],
      sorted.map(
        (l) => `
        <tr>
          <td><strong>${date(l.date)}</strong><small>${esc(name('courses', l.courseId))}</small></td>
          <td>${esc(l.topic)}</td>
          <td>${Object.values(l.attendance).filter(Boolean).length}</td>
          <td>${Object.values(l.attendance).filter((v) => !v).length}</td>
          <td>
            <div class="actions">
              ${button('Ver / editar', 'edit-lesson', l.id)}
              ${button('Excluir', 'delete-lesson', l.id, 'danger small')}
            </div>
          </td>
        </tr>`
      )
    )
  );
}

function requests() {
  const list = [...db.requests]
    .reverse()
    .filter(
      (r) =>
        (!filter || r.status === filter) &&
        matches(name('students', r.studentId) + ' ' + name('courses', find('lessons', r.lessonId)?.courseId))
    );

  return (
    head('Justificativas de faltas', 'O diferencial do Campus: prazos, créditos e análise em um único fluxo.', 'new-request', 'Enviar justificativa') +
    `<div class="notice"><strong>Como funciona:</strong> o aluno envia o motivo dentro do prazo; o professor analisa. Pedidos pessoais reservam 1 dos ${db.credits} créditos até a decisão. Pedidos documentados não consomem créditos. A aprovação registra o motivo aceito e preserva a frequência real.</div>` +
    toolbar(
      'Buscar aluno ou disciplina...',
      opts(['Pendente', 'Aprovada', 'Recusada'].map((s) => ({ id: s, name: s })), filter, 'Todas as situações')
    ) +
    table(
      ['ALUNO / DISCIPLINA', 'TIPO', 'SITUAÇÃO', 'DATA DA FALTA', 'AÇÕES'],
      list.map(
        (r) => `
        <tr>
          <td><strong>${esc(name('students', r.studentId))}</strong><small>${esc(name('courses', find('lessons', r.lessonId)?.courseId))}</small></td>
          <td>${esc(r.type)}</td>
          <td>${badge(r.status)}</td>
          <td>${date(find('lessons', r.lessonId)?.date)}</td>
          <td>
            <div class="actions">
              ${button(r.status === 'Pendente' ? 'Analisar' : 'Detalhes', 'review', r.id)}
              ${r.status === 'Pendente' ? button('Editar', 'edit-request', r.id) + button('Excluir', 'delete-request', r.id, 'danger small') : ''}
            </div>
          </td>
        </tr>`
      )
    )
  );
}

function reportRows() {
  const rows = [];
  db.students.forEach((s) =>
    db.courses
      .filter(
        (c) =>
          (!filter || c.id === filter) &&
          (c.groupId === s.groupId || db.lessons.some((l) => l.courseId === c.id && Object.hasOwn(l.attendance, s.id)))
      )
      .forEach((c) => {
        if (matches(s.name + ' ' + s.code)) {
          const f = C.frequency(db, s.id, c.id);
          rows.push({ s, c, f });
        }
      })
  );
  return rows;
}

function reports() {
  return (
    head('Relatórios de frequência', 'Consulte presenças e faltas por aluno e disciplina.') +
    `<div class="report-bar">
      <p>Cada chamada representa uma aula. Justificativas aprovadas não apagam faltas.</p>
      <div class="actions">${button('Exportar CSV', 'export')}${button('Imprimir', 'print')}</div>
    </div>` +
    toolbar('Buscar aluno ou matrícula...', opts(db.courses, filter, 'Todas as disciplinas')) +
    table(
      ['ALUNO', 'DISCIPLINA', 'AULAS', 'PRESENÇAS', 'FALTAS', 'FREQUÊNCIA', 'SITUAÇÃO'],
      reportRows().map(
        ({ s, c, f }) => `
        <tr>
          <td><strong>${esc(s.name)}</strong><small>${esc(s.code)}</small></td>
          <td>${esc(c.name)}</td>
          <td>${f.total}</td>
          <td>${f.present}</td>
          <td>${f.absent}</td>
          <td class="numeric">${percent(f.percent)}</td>
          <td>${badge(f.percent === null ? 'Sem registros' : f.percent < 75 ? 'Baixa frequência' : 'Regular')}</td>
        </tr>`
      )
    ) +
    `<section class="panel">
      <div class="panel-head">
        <div>
          <h2>Acompanhamento das faltas</h2>
          <p>Data-limite e situação de cada ausência</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>ALUNO</th><th>DISCIPLINA / AULA</th><th>PRAZO ATÉ</th><th>SITUAÇÃO</th></tr>
          </thead>
          <tbody>
            ${db.lessons
              .filter((l) => !filter || l.courseId === filter)
              .sort((a, b) => b.date.localeCompare(a.date))
              .flatMap((l) =>
                Object.entries(l.attendance)
                  .filter(([sid, p]) => !p && matches(name('students', sid) + ' ' + find('students', sid)?.code))
                  .map(
                    ([sid]) => `
                    <tr>
                      <td>${esc(name('students', sid))}</td>
                      <td>${esc(name('courses', l.courseId))}<small>${date(l.date)}</small></td>
                      <td>${date(C.deadline(l))}, 23h59</td>
                      <td>${badge(C.absenceStatus(db, l, sid))}</td>
                    </tr>`
                  )
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>`
  );
}

function render() {
  page = Object.hasOwn(names, location.hash.slice(1)) ? location.hash.slice(1) : 'painel';
  $('#crumb').textContent = names[page];

  $('#nav').innerHTML = Object.entries(names)
    .map(
      ([key, label]) => `
      <a target="_self" href="#${key}" class="${page === key ? 'active' : ''}" ${page === key ? 'aria-current="page"' : ''}>
        ${icon(key)}${key === 'chamada' ? 'Chamada e frequência' : label}
        ${key === 'justificativas' ? `<span class="nav-badge">${db.requests.filter((r) => r.status === 'Pendente').length}</span>` : ''}
      </a>`
    )
    .join('');

  const views = {
    painel: dashboard,
    alunos: students,
    turmas: groups,
    disciplinas: courses,
    chamada: lessons,
    justificativas: requests,
    relatorios: reports,
  };

  $('#main').innerHTML = views[page]();
}

const field = (label, key, value = '', type = 'text', extra = '') =>
  `<label class="field">${label}<input name="${key}" type="${type}" value="${esc(value)}" ${extra} required></label>`;

const select = (label, key, options, extra = '') =>
  `<label class="field">${label}<select name="${key}" required ${extra}>${options}</select></label>`;

function modal(title, html, onSubmit) {
  $('#modal-title').textContent = title;
  $('#fields').innerHTML = html;
  $('#form-error').textContent = '';
  $('#form button[type=submit]').style.display = '';
  $('#form button[type=submit]').textContent = 'Salvar';

  $('#form').onsubmit = async (e) => {
    e.preventDefault();
    $('#form-error').textContent = '';
    try {
      await onSubmit(Object.fromEntries(new FormData(e.target)));
    } catch (err) {
      $('#form-error').textContent = err.message || 'Não foi possível concluir.';
    }
  };

  $('#modal').showModal();
}

function close() {
  $('#modal').close();
}

function finish(change, message) {
  if (commit(change)) {
    close();
    toast(message);
  }
}

const assert = (ok, msg) => {
  if (!ok) throw Error(msg);
};

function editStudent(id) {
  if (!db.groups.length) return toast('Cadastre uma turma antes de cadastrar alunos.');
  const s = find('students', id) || {};

  modal(
    s.id ? 'Editar aluno' : 'Cadastrar aluno',
    field('Nome completo', 'name', s.name, 'text', 'maxlength="100"') +
      `<div class="split">
        ${field('Matrícula', 'code', s.code, 'text', 'maxlength="30"')}
        ${select('Turma', 'groupId', opts(db.groups, s.groupId))}
      </div>` +
      field('E-mail', 'email', s.email, 'email', 'maxlength="120"'),
    (v) => {
      v.name = v.name.trim();
      v.code = v.code.trim();
      assert(v.name && v.code, 'Preencha nome e matrícula.');
      assert(!db.students.some((x) => x.id !== id && x.code.toLowerCase() === v.code.toLowerCase()), 'Esta matrícula já está cadastrada.');
      assert(!id || s.groupId === v.groupId || !db.lessons.some((l) => Object.hasOwn(l.attendance, id)), 'Aluno com histórico de chamada não pode mudar de turma neste protótipo.');
      finish(() => (id ? Object.assign(s, v) : db.students.push({ ...v, id: uid() })), 'Aluno salvo.');
    }
  );
}

function editGroup(id) {
  const g = find('groups', id) || {};

  modal(
    g.id ? 'Editar turma' : 'Criar turma',
    field('Nome da turma', 'name', g.name, 'text', 'maxlength="100"') +
      `<div class="split">
        ${select('Turno', 'period', opts(['Matutino', 'Vespertino', 'Noturno', 'Integral'].map((n) => ({ id: n, name: n })), g.period))}
        ${field('Semestre', 'semester', g.semester || '2026.2', 'text', 'pattern="[0-9]{4}\\.[12]" placeholder="2026.2"')}
      </div>`,
    (v) => {
      v.name = v.name.trim();
      assert(v.name, 'Informe o nome.');
      assert(!db.groups.some((x) => x.id !== id && x.name.toLowerCase() === v.name.toLowerCase() && x.semester === v.semester), 'Já existe uma turma com este nome neste semestre.');
      finish(() => (id ? Object.assign(g, v) : db.groups.push({ ...v, id: uid() })), 'Turma salva.');
    }
  );
}

function editCourse(id) {
  if (!db.groups.length) return toast('Cadastre uma turma primeiro.');
  const c = find('courses', id) || {};

  modal(
    c.id ? 'Editar disciplina' : 'Nova disciplina',
    field('Nome da disciplina', 'name', c.name, 'text', 'maxlength="100"') +
      field('Professor responsável', 'teacher', c.teacher, 'text', 'maxlength="100"') +
      `<div class="split">
        ${select('Turma', 'groupId', opts(db.groups, c.groupId))}
        ${field('Prazo de justificativa (dias corridos)', 'days', c.days ?? 3, 'number', 'min="1" max="30" step="1"')}
      </div>
      <div class="notice">Alterar o prazo afeta somente novas chamadas. As aulas anteriores mantêm o prazo original.</div>`,
    (v) => {
      v.name = v.name.trim();
      v.teacher = v.teacher.trim();
      v.days = Number(v.days);
      assert(v.name && v.teacher, 'Informe disciplina e professor.');
      assert(!db.courses.some((x) => x.id !== id && x.groupId === v.groupId && x.name.toLowerCase() === v.name.toLowerCase()), 'Disciplina já cadastrada nesta turma.');
      assert(!id || c.groupId === v.groupId || !db.lessons.some((l) => l.courseId === id), 'Disciplina com aulas registradas não pode mudar de turma.');
      finish(() => (id ? Object.assign(c, v) : db.courses.push({ ...v, id: uid() })), 'Disciplina salva.');
    }
  );
}

function editLesson(id) {
  if (!db.courses.length) return toast('Cadastre uma disciplina primeiro.');
  const l = find('lessons', id) || {};
  const hasRequests = id && db.requests.some((r) => r.lessonId === id);

  modal(
    id ? 'Editar chamada' : 'Registrar chamada',
    `<div class="split">
      ${select('Disciplina', 'courseId', opts(db.courses, l.courseId), id ? 'disabled' : '')}
      ${field('Data da aula', 'date', l.date || C.today(), 'date', `max="${C.today()}" ${hasRequests ? 'readonly' : ''}`)}
    </div>` +
      field('Conteúdo / descrição da aula', 'topic', l.topic, 'text', 'maxlength="160"') +
      `<div class="report-bar">
        <span class="eyebrow">LISTA DE PRESENÇA</span>
        <button type="button" class="button secondary small" id="all-present">Marcar todos presentes</button>
      </div>
      <div class="roll-list" id="roll"></div>
      <small style="color:#8c9784">Uma chamada por disciplina em cada dia. Cada chamada vale uma aula.</small>`,
    (v) => {
      v.courseId = id ? l.courseId : v.courseId;
      assert(v.date <= C.today(), 'Não é possível registrar chamadas futuras.');
      assert(!db.lessons.some((x) => x.id !== id && x.courseId === v.courseId && x.date === v.date), 'Já existe uma chamada para esta disciplina nesta data.');

      const attendance = {};
      $('#roll')
        .querySelectorAll('select')
        .forEach((el) => (attendance[el.dataset.student] = el.value === 'true'));

      assert(Object.keys(attendance).length, 'A turma precisa ter pelo menos um aluno.');
      if (id) {
        assert(
          !db.requests.some((r) => r.lessonId === id && attendance[r.studentId] !== false),
          'Uma falta com justificativa vinculada não pode ser convertida em presença.'
        );
      }

      const data = {
        courseId: v.courseId,
        date: v.date,
        topic: v.topic.trim(),
        attendance,
        days: l.days ?? find('courses', v.courseId).days,
      };
      assert(data.topic, 'Informe o conteúdo da aula.');

      finish(() => (id ? Object.assign(l, data) : db.lessons.push({ ...data, id: uid() })), 'Chamada salva. Frequência atualizada.');
    }
  );

  function roll() {
    const c = find('courses', $('[name=courseId]').value);
    const members = id
      ? db.students.filter((s) => Object.hasOwn(l.attendance, s.id))
      : db.students.filter((s) => s.groupId === c?.groupId);

    $('#roll').innerHTML = members.length
      ? members
          .map(
            (s) => `
          <div class="roll-item">
            <span>${esc(s.name)}<small style="display:block;color:#8d9787">${esc(s.code)}</small></span>
            <select aria-label="Presença de ${esc(s.name)}" data-student="${esc(s.id)}">
              <option value="true">Presente</option>
              <option value="false" ${l.attendance?.[s.id] === false ? 'selected' : ''}>Falta</option>
            </select>
          </div>`
          )
          .join('')
      : empty('Nenhum aluno nesta turma.', 'Selecione uma disciplina com alunos cadastrados.');
  }

  $('[name=courseId]').onchange = roll;
  $('#all-present').onclick = () => $('#roll').querySelectorAll('select').forEach((el) => (el.value = 'true'));
  roll();
}

function editRequest(id) {
  const r = find('requests', id) || {};
  if (id && (r.status !== 'Pendente' || C.today() > C.deadline(find('lessons', r.lessonId)))) {
    return toast('Somente pedidos pendentes e dentro do prazo podem ser editados.');
  }

  modal(
    id ? 'Editar justificativa' : 'Enviar justificativa',
    select('Aluno', 'studentId', opts(db.students, r.studentId), id ? 'disabled' : '') +
      `<div id="credit-info" class="notice"></div>` +
      select('Falta a justificar', 'lessonId', '', id ? 'disabled' : '') +
      select(
        'Tipo de justificativa',
        'type',
        opts(
          [
            { id: 'Pessoal', name: 'Pessoal · utiliza 1 crédito' },
            { id: 'Documentada', name: 'Documentada · análise sem crédito' },
          ],
          r.type || 'Pessoal'
        )
      ) +
      `<label class="field">Motivo da ausência<textarea name="reason" required maxlength="1500" placeholder="Descreva o motivo da ausência...">${esc(r.reason)}</textarea></label>` +
      `<label class="field">Comprovante fictício (opcional)<input type="file" name="file" accept="image/png,image/jpeg,image/webp"><small>Imagem PNG, JPG ou WebP de até 400 KB. Use apenas documentos fictícios.${r.attachment ? ' Um anexo já está salvo; um novo arquivo o substituirá.' : ''}</small></label>`,
    async (v) => {
      v.studentId = id ? r.studentId : v.studentId;
      v.lessonId = id ? r.lessonId : v.lessonId;

      const data = {
        studentId: v.studentId,
        lessonId: v.lessonId,
        type: v.type,
        reason: v.reason.trim(),
      };

      const err = C.requestError(db, data, id);
      assert(!err, err);

      let attachment = r.attachment || null;
      const file = $('[name=file]').files[0];
      if (file?.size) {
        assert(['image/png', 'image/jpeg', 'image/webp'].includes(file.type), 'Use uma imagem PNG, JPG ou WebP.');
        assert(file.size <= 400 * 1024, 'O arquivo precisa ter até 400 KB.');
        attachment = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ name: file.name, url: reader.result });
          reader.onerror = () => reject(Error('Não foi possível ler o arquivo.'));
          reader.readAsDataURL(file);
        });
      }

      finish(
        () =>
          id
            ? Object.assign(r, data, { attachment })
            : db.requests.push({ ...data, id: uid(), status: 'Pendente', createdAt: C.today(), decision: '', attachment }),
        'Justificativa enviada para análise.'
      );
    }
  );

  function update() {
    const sid = $('[name=studentId]').value;
    $('#credit-info').textContent = sid
      ? `${C.balance(db, sid)} de ${db.credits} créditos pessoais disponíveis. O prazo termina às 23h59 do dia indicado.`
      : 'Selecione um aluno para consultar o saldo e as faltas disponíveis.';

    const available = db.lessons.filter(
      (l) =>
        l.attendance[sid] === false &&
        ((id && l.id === r.lessonId) || (!db.requests.some((x) => x.lessonId === l.id && x.studentId === sid) && C.today() <= C.deadline(l)))
    );

    $('[name=lessonId]').innerHTML = opts(
      available.map((l) => ({
        id: l.id,
        name: `${name('courses', l.courseId)} · ${date(l.date)} · até ${date(C.deadline(l))}`,
      })),
      r.lessonId,
      available.length ? 'Selecione a falta' : 'Nenhuma falta disponível dentro do prazo'
    );
  }

  $('[name=studentId]').onchange = update;
  update();
  $('#form button[type=submit]').textContent = id ? 'Salvar alterações' : 'Enviar para análise';
}

function review(id) {
  const r = find('requests', id);
  const l = find('lessons', r.lessonId);

  modal(
    r.status === 'Pendente' ? 'Analisar justificativa' : 'Detalhes da justificativa',
    `<div class="notice">
      <strong>${esc(name('students', r.studentId))}</strong><br>
      ${esc(name('courses', l.courseId))} · Falta em ${date(l.date)}<br>
      ${esc(r.type)} · Enviado em ${date(r.createdAt)} · ${badge(r.status)}
    </div>
    <span class="eyebrow">RELATO DO ALUNO</span>
    <p class="detail">${esc(r.reason)}</p>
    ${r.attachment ? `<label class="field">${esc(r.attachment.name)}</label><img class="attachment" src="${esc(r.attachment.url)}" alt="Comprovante fictício anexado">` : ''}
    ${
      r.status === 'Pendente'
        ? select(
            'Decisão',
            'status',
            opts([
              { id: 'Aprovada', name: 'Aprovar justificativa' },
              { id: 'Recusada', name: 'Recusar justificativa' },
            ])
          ) +
          `<label class="field">Parecer do professor<textarea name="decision" required maxlength="1000" placeholder="Registre o motivo da decisão..."></textarea></label>`
        : `<span class="eyebrow">PARECER</span><p class="detail">${esc(r.decision)}</p>`
    }`,
    (v) => {
      assert(v.decision.trim(), 'Registre o motivo da decisão.');
      finish(() => Object.assign(r, { status: v.status, decision: v.decision.trim() }), 'Análise registrada.');
    }
  );

  if (r.status !== 'Pendente') $('#form button[type=submit]').style.display = 'none';
  else $('#form button[type=submit]').textContent = 'Confirmar decisão';
}

function remove(type, id) {
  const item = find(type, id);
  let blocked = '';

  if (type === 'groups' && (db.students.some((s) => s.groupId === id) || db.courses.some((c) => c.groupId === id))) {
    blocked = 'Esta turma tem alunos ou disciplinas vinculados.';
  }
  if (type === 'students' && db.lessons.some((l) => Object.hasOwn(l.attendance, id))) {
    blocked = 'Este aluno tem histórico de chamadas.';
  }
  if (type === 'courses' && db.lessons.some((l) => l.courseId === id)) {
    blocked = 'Esta disciplina tem aulas registradas.';
  }
  if (type === 'lessons' && db.requests.some((r) => r.lessonId === id)) {
    blocked = 'Esta aula tem justificativas vinculadas.';
  }
  if (type === 'requests' && item.status !== 'Pendente') {
    blocked = 'Pedidos analisados fazem parte do histórico.';
  }

  if (blocked) return toast(blocked + ' Exclua os vínculos permitidos primeiro.');

  modal(
    'Excluir registro',
    `<p class="detail">Excluir ${esc(item.name || item.topic || 'esta justificativa')}? Esta ação não pode ser desfeita.${type === 'requests' ? ' O crédito reservado será liberado.' : ''}</p>`,
    () => finish(() => (db[type] = db[type].filter((x) => x.id !== id)), 'Registro excluído.')
  );
  $('#form button[type=submit]').textContent = 'Confirmar exclusão';
}

function exportCSV() {
  const csvCell = (v) => '"' + String(v ?? '').replace(/^[=+@-]/, "'").replaceAll('"', '""') + '"';
  const rows = [
    ['Aluno', 'Matrícula', 'Disciplina', 'Aulas', 'Presenças', 'Faltas', 'Frequência (%)'],
    ...reportRows().map(({ s, c, f }) => [s.name, s.code, c.name, f.total, f.present, f.absent, f.percent ?? 'Sem registros']),
  ];

  const blob = new Blob(['\ufeff' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'campus-frequencia.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Relatório exportado.');
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;

  const a = el.dataset.action;
  const id = el.dataset.id;
  const handlers = {
    'new-student': () => editStudent(),
    'edit-student': () => editStudent(id),
    'new-group': () => editGroup(),
    'edit-group': () => editGroup(id),
    'new-course': () => editCourse(),
    'edit-course': () => editCourse(id),
    'new-lesson': () => editLesson(),
    'edit-lesson': () => editLesson(id),
    'new-request': () => editRequest(),
    'edit-request': () => editRequest(id),
    review: () => review(id),
    export: exportCSV,
    print: () => window.print(),
  };

  if (a.startsWith('delete-')) {
    const map = { student: 'students', group: 'groups', course: 'courses', lesson: 'lessons', request: 'requests' };
    remove(map[a.slice(7)], id);
  } else {
    handlers[a]?.();
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'search') {
    const start = e.target.selectionStart;
    query = e.target.value;
    render();
    $('#search').focus();
    $('#search').setSelectionRange(start, start);
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'filter') {
    filter = e.target.value;
    render();
  }
});

window.addEventListener('hashchange', () => {
  query = '';
  filter = '';
  render();
});

$('#close-modal').onclick = close;
$('#cancel-modal').onclick = close;

$('#reset').onclick = () => {
  modal(
    'Restaurar demonstração',
    '<p class="detail">Isso substitui todos os dados deste navegador pelos exemplos fictícios iniciais. Os cadastros e alterações atuais serão perdidos.</p>',
    () => finish(() => (db = C.seed()), 'Dados de demonstração restaurados.')
  );
  $('#form button[type=submit]').textContent = 'Restaurar dados';
};

render();
