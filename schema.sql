-- Schema inicial para a futura versão com Supabase/Postgres.
-- Esta primeira versão do app usa localStorage, mas este SQL já deixa a base preparada.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  tipo_usuario text not null default 'funcionario' check (tipo_usuario in ('dono', 'gerente', 'funcionario')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  apelido text,
  telefone text,
  foto_url text,
  limite_fiado numeric(12,2) not null default 0,
  dia_pagamento text,
  status_manual text,
  observacoes text,
  criado_por uuid references public.profiles(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.movimentacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tipo text not null check (tipo in ('fiado', 'pagamento', 'desconto', 'estorno', 'ajuste')),
  valor numeric(12,2) not null check (valor > 0),
  descricao text,
  forma_pagamento text,
  data_vencimento date,
  criado_por uuid references public.profiles(id),
  criado_em timestamptz not null default now()
);

create table if not exists public.cobrancas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  valor_cobrado numeric(12,2) not null default 0,
  mensagem text,
  canal text not null default 'whatsapp',
  status text not null default 'registrada',
  criado_por uuid references public.profiles(id),
  criado_em timestamptz not null default now()
);

create table if not exists public.auditoria (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.profiles(id),
  acao text not null,
  entidade text not null,
  entidade_id uuid,
  detalhes jsonb,
  criado_em timestamptz not null default now()
);

create or replace view public.saldos_clientes as
select
  c.id as cliente_id,
  coalesce(sum(
    case
      when m.tipo = 'fiado' then m.valor
      when m.tipo in ('pagamento', 'desconto', 'estorno') then -m.valor
      else 0
    end
  ), 0) as saldo
from public.clientes c
left join public.movimentacoes m on m.cliente_id = c.id
group by c.id;
