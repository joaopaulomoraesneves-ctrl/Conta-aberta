import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Plus, Wallet, Users, AlertTriangle, MessageCircle, Search, CheckCircle2, Ban, History } from 'lucide-react';
import './styles.css';

const STORAGE_KEY = 'conta-aberta:v1';

const initialData = {
  clientes: [
    {
      id: crypto.randomUUID(),
      nome: 'Carlos Almeida',
      apelido: 'Carlinhos',
      telefone: '5599999999999',
      limite: 150,
      diaPagamento: 'Sábado',
      observacoes: 'Cliente antigo, costuma pagar no fim de semana.',
      criadoEm: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      nome: 'Marcos Silva',
      apelido: 'Marcão',
      telefone: '5598888888888',
      limite: 100,
      diaPagamento: 'Sexta',
      observacoes: 'Cobrar antes de liberar novo fiado.',
      criadoEm: new Date().toISOString()
    }
  ],
  movimentacoes: []
};

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : initialData;
  } catch {
    return initialData;
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysLate(date) {
  if (!date) return 0;
  const due = new Date(date + 'T23:59:59');
  const now = new Date();
  const diff = Math.floor((now - due) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

function calcSaldo(clienteId, movimentacoes) {
  return movimentacoes
    .filter((m) => m.clienteId === clienteId)
    .reduce((total, m) => {
      if (m.tipo === 'fiado') return total + Number(m.valor);
      if (['pagamento', 'desconto', 'estorno'].includes(m.tipo)) return total - Number(m.valor);
      return total;
    }, 0);
}

function getStatus(cliente, movimentacoes) {
  const saldo = calcSaldo(cliente.id, movimentacoes);
  const fiadosAbertos = movimentacoes.filter((m) => m.clienteId === cliente.id && m.tipo === 'fiado');
  const maiorAtraso = fiadosAbertos.reduce((max, m) => Math.max(max, daysLate(m.vencimento)), 0);

  if (saldo >= Number(cliente.limite || 0) || maiorAtraso >= 15) return 'bloqueado';
  if (saldo >= Number(cliente.limite || 0) * 0.75 || maiorAtraso >= 7) return 'atenção';
  return 'liberado';
}

function App() {
  const [data, setData] = useState(loadData);
  const [page, setPage] = useState('dashboard');
  const [selectedClienteId, setSelectedClienteId] = useState(null);
  const [search, setSearch] = useState('');

  function update(next) {
    setData(next);
    saveData(next);
  }

  const clientesComSaldo = useMemo(() => {
    return data.clientes.map((cliente) => {
      const saldo = calcSaldo(cliente.id, data.movimentacoes);
      return { ...cliente, saldo, status: getStatus(cliente, data.movimentacoes) };
    });
  }, [data]);

  const totais = useMemo(() => {
    const totalReceber = clientesComSaldo.reduce((sum, c) => sum + Math.max(0, c.saldo), 0);
    const recebidoHoje = data.movimentacoes
      .filter((m) => m.tipo === 'pagamento' && m.criadoEm?.slice(0, 10) === todayISO())
      .reduce((sum, m) => sum + Number(m.valor), 0);
    const fiadoHoje = data.movimentacoes
      .filter((m) => m.tipo === 'fiado' && m.criadoEm?.slice(0, 10) === todayISO())
      .reduce((sum, m) => sum + Number(m.valor), 0);
    const vencido = data.movimentacoes
      .filter((m) => m.tipo === 'fiado' && daysLate(m.vencimento) > 0)
      .reduce((sum, m) => sum + Number(m.valor), 0);
    return { totalReceber, recebidoHoje, fiadoHoje, vencido };
  }, [data, clientesComSaldo]);

  const selectedCliente = clientesComSaldo.find((c) => c.id === selectedClienteId);

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Controle de fiados</p>
          <h1>Conta Aberta</h1>
        </div>
        <button className="ghost" onClick={() => setPage('dashboard')}>Início</button>
      </header>

      <nav className="tabs">
        <button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>Dashboard</button>
        <button className={page === 'clientes' ? 'active' : ''} onClick={() => setPage('clientes')}>Clientes</button>
        <button className={page === 'novoFiado' ? 'active' : ''} onClick={() => setPage('novoFiado')}>Novo fiado</button>
        <button className={page === 'pagamento' ? 'active' : ''} onClick={() => setPage('pagamento')}>Receber</button>
        <button className={page === 'cobrancas' ? 'active' : ''} onClick={() => setPage('cobrancas')}>Cobranças</button>
      </nav>

      {page === 'dashboard' && (
        <section className="grid">
          <Card icon={<Wallet />} label="Total a receber" value={money(totais.totalReceber)} />
          <Card icon={<AlertTriangle />} label="Total vencido" value={money(totais.vencido)} />
          <Card icon={<CheckCircle2 />} label="Recebido hoje" value={money(totais.recebidoHoje)} />
          <Card icon={<Plus />} label="Fiado lançado hoje" value={money(totais.fiadoHoje)} />
          <div className="panel full">
            <h2>Atalhos rápidos</h2>
            <div className="actions">
              <button onClick={() => setPage('novoFiado')}><Plus size={18} /> Novo fiado</button>
              <button onClick={() => setPage('pagamento')}><Wallet size={18} /> Receber pagamento</button>
              <button onClick={() => setPage('clientes')}><Users size={18} /> Clientes</button>
              <button onClick={() => setPage('cobrancas')}><MessageCircle size={18} /> Cobranças</button>
            </div>
          </div>
        </section>
      )}

      {page === 'clientes' && (
        <Clientes
          clientes={clientesComSaldo}
          movimentacoes={data.movimentacoes}
          search={search}
          setSearch={setSearch}
          onSelect={(id) => { setSelectedClienteId(id); setPage('historico'); }}
          onCreate={(cliente) => update({ ...data, clientes: [...data.clientes, cliente] })}
        />
      )}

      {page === 'novoFiado' && (
        <MovForm
          title="Lançar novo fiado"
          clientes={clientesComSaldo}
          tipo="fiado"
          onSave={(mov) => update({ ...data, movimentacoes: [mov, ...data.movimentacoes] })}
        />
      )}

      {page === 'pagamento' && (
        <MovForm
          title="Receber pagamento"
          clientes={clientesComSaldo.filter((c) => c.saldo > 0)}
          tipo="pagamento"
          onSave={(mov) => update({ ...data, movimentacoes: [mov, ...data.movimentacoes] })}
        />
      )}

      {page === 'cobrancas' && (
        <Cobrancas clientes={clientesComSaldo} movimentacoes={data.movimentacoes} />
      )}

      {page === 'historico' && selectedCliente && (
        <Historico cliente={selectedCliente} movimentacoes={data.movimentacoes.filter((m) => m.clienteId === selectedCliente.id)} />
      )}
    </main>
  );
}

function Card({ icon, label, value }) {
  return (
    <div className="card">
      <span className="cardIcon">{icon}</span>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function Clientes({ clientes, search, setSearch, onSelect, onCreate }) {
  const [form, setForm] = useState({ nome: '', apelido: '', telefone: '', limite: 100, diaPagamento: 'Sábado', observacoes: '' });
  const filtered = clientes.filter((c) => `${c.nome} ${c.apelido}`.toLowerCase().includes(search.toLowerCase()));

  function submit(e) {
    e.preventDefault();
    if (!form.nome.trim()) return alert('Informe o nome do cliente.');
    onCreate({ ...form, id: crypto.randomUUID(), limite: Number(form.limite || 0), criadoEm: new Date().toISOString() });
    setForm({ nome: '', apelido: '', telefone: '', limite: 100, diaPagamento: 'Sábado', observacoes: '' });
  }

  return (
    <section className="split">
      <div className="panel">
        <h2>Novo cliente</h2>
        <form onSubmit={submit} className="form">
          <input placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input placeholder="Apelido" value={form.apelido} onChange={(e) => setForm({ ...form, apelido: e.target.value })} />
          <input placeholder="WhatsApp com DDD" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          <input type="number" placeholder="Limite" value={form.limite} onChange={(e) => setForm({ ...form, limite: e.target.value })} />
          <input placeholder="Dia de pagamento" value={form.diaPagamento} onChange={(e) => setForm({ ...form, diaPagamento: e.target.value })} />
          <textarea placeholder="Observações" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          <button type="submit">Cadastrar cliente</button>
        </form>
      </div>

      <div className="panel">
        <h2>Clientes</h2>
        <label className="search"><Search size={18} /><input placeholder="Buscar cliente" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <div className="list">
          {filtered.map((c) => (
            <button className="row" key={c.id} onClick={() => onSelect(c.id)}>
              <div>
                <strong>{c.apelido || c.nome}</strong>
                <small>{c.nome}</small>
              </div>
              <div className="right">
                <b>{money(c.saldo)}</b>
                <span className={`badge ${c.status}`}>{c.status}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function MovForm({ title, clientes, tipo, onSave }) {
  const [form, setForm] = useState({ clienteId: '', valor: '', descricao: '', vencimento: todayISO(), formaPagamento: 'Pix' });

  function submit(e) {
    e.preventDefault();
    if (!form.clienteId || !Number(form.valor)) return alert('Escolha o cliente e informe o valor.');
    const cliente = clientes.find((c) => c.id === form.clienteId);
    if (tipo === 'fiado' && cliente?.status === 'bloqueado') {
      const ok = confirm('Este cliente está bloqueado. Deseja lançar mesmo assim?');
      if (!ok) return;
    }
    onSave({
      id: crypto.randomUUID(),
      clienteId: form.clienteId,
      tipo,
      valor: Number(form.valor),
      descricao: form.descricao || (tipo === 'fiado' ? 'Compra fiada' : 'Pagamento'),
      vencimento: tipo === 'fiado' ? form.vencimento : null,
      formaPagamento: tipo === 'pagamento' ? form.formaPagamento : null,
      criadoEm: new Date().toISOString()
    });
    setForm({ clienteId: '', valor: '', descricao: '', vencimento: todayISO(), formaPagamento: 'Pix' });
    alert(tipo === 'fiado' ? 'Fiado lançado com sucesso.' : 'Pagamento registrado com sucesso.');
  }

  return (
    <section className="panel narrow">
      <h2>{title}</h2>
      <form className="form" onSubmit={submit}>
        <select value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })}>
          <option value="">Selecione o cliente</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.apelido || c.nome} — saldo {money(c.saldo)}</option>)}
        </select>
        <input type="number" step="0.01" placeholder="Valor" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
        <input placeholder="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
        {tipo === 'fiado' && <input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} />}
        {tipo === 'pagamento' && (
          <select value={form.formaPagamento} onChange={(e) => setForm({ ...form, formaPagamento: e.target.value })}>
            <option>Pix</option>
            <option>Dinheiro</option>
            <option>Débito</option>
            <option>Crédito</option>
            <option>Misto</option>
          </select>
        )}
        <button type="submit">{tipo === 'fiado' ? 'Confirmar fiado' : 'Confirmar pagamento'}</button>
      </form>
    </section>
  );
}

function Cobrancas({ clientes, movimentacoes }) {
  const devedores = clientes.filter((c) => c.saldo > 0).sort((a, b) => b.saldo - a.saldo);

  function whatsapp(cliente) {
    const msg = `Olá, ${cliente.apelido || cliente.nome}. Tudo bem? Aqui é do bar. Passando para lembrar que sua conta em aberto está em ${money(cliente.saldo)}. Quando puder, acerte conosco. Obrigado!`;
    const phone = String(cliente.telefone || '').replace(/\D/g, '');
    if (!phone) return alert('Cliente sem telefone cadastrado.');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  return (
    <section className="panel">
      <h2>Cobranças</h2>
      <div className="list">
        {devedores.map((c) => {
          const atrasos = movimentacoes.filter((m) => m.clienteId === c.id && m.tipo === 'fiado').map((m) => daysLate(m.vencimento));
          const maiorAtraso = Math.max(0, ...atrasos);
          return (
            <div className="row" key={c.id}>
              <div>
                <strong>{c.apelido || c.nome}</strong>
                <small>{maiorAtraso > 0 ? `${maiorAtraso} dias em atraso` : 'Dentro do prazo ou sem vencimento atrasado'}</small>
              </div>
              <div className="right">
                <b>{money(c.saldo)}</b>
                <button className="small" onClick={() => whatsapp(c)}><MessageCircle size={16} /> WhatsApp</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Historico({ cliente, movimentacoes }) {
  return (
    <section className="panel">
      <h2><History size={20} /> Histórico de {cliente.apelido || cliente.nome}</h2>
      <div className="clientSummary">
        <span>Saldo: <strong>{money(cliente.saldo)}</strong></span>
        <span>Limite: <strong>{money(cliente.limite)}</strong></span>
        <span>Status: <strong className={`text-${cliente.status}`}>{cliente.status}</strong></span>
      </div>
      <div className="list">
        {movimentacoes.map((m) => (
          <div className="row" key={m.id}>
            <div>
              <strong>{m.descricao}</strong>
              <small>{new Date(m.criadoEm).toLocaleString('pt-BR')} {m.vencimento ? `• vence ${new Date(m.vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}</small>
            </div>
            <b className={m.tipo === 'fiado' ? 'debit' : 'credit'}>{m.tipo === 'fiado' ? '+' : '-'}{money(m.valor)}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

createRoot(document.getElementById('root')).render(<App />);
