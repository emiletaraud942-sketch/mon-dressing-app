drop schema if exists t cascade; create schema t;
grant usage on schema t to authenticated, anon;
-- exécute sql en tant qu'utilisateur (uid null = anon) ; renvoie OK[:valeur] ou ERR code message
create function t.as(uid uuid, q text) returns text language plpgsql as $$
declare r text; n bigint;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text,''), true);
  if uid is null then execute 'set local role anon'; else execute 'set local role authenticated'; end if;
  begin
    if q ~* '^\s*select' then execute 'select coalesce(string_agg(v::text, E''\n''),''<0 rows>'') from (' || q || ') x(v)' into r; r := 'OK ' || r;
    else execute q; get diagnostics n = row_count; r := 'OK rows=' || n; end if;
  exception when others then r := 'ERR ' || sqlstate || ' ' || sqlerrm;
  end;
  execute 'reset role';
  return r;
end $$;
create function t.expect(label text, got text, want_prefix text) returns void language plpgsql as $$
begin
  if left(got, length(want_prefix)) = want_prefix then raise notice 'PASS  %  -> %', label, left(got,110);
  else raise notice 'FAIL  %  -> % (attendu %)', label, left(got,160), want_prefix; end if;
end $$;
