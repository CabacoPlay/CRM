create or replace function public.touch_contato_from_mensagem()
returns trigger
language plpgsql
as $$
begin
  update public.contatos
  set
    resumo = left(coalesce(new.conteudo, ''), 200),
    conversa_status = 'aberta',
    conversa_resolvida_em = null,
    conversa_resolvida_por = null,
    oculta = false
  where id = new.contato_id;

  return new;
end;
$$;
