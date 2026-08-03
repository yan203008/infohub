interface Env {
  GATEWAY: Fetcher;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  return env.GATEWAY.fetch(request);
};
