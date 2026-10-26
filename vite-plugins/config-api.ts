import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Connect, Plugin } from 'vite';

/**
 * A stand-in for the configuration backend.
 *
 * The point of the demo is that the editor is configured from a server, so the
 * config must arrive over HTTP and be visible in the Network tab — not be
 * imported as a module. In dev this middleware reads the JSON off disk on every
 * request (no caching), so editing a profile and reloading is the whole
 * iteration loop.
 *
 *   GET /api/profiles.json              -> the switcher menu
 *   GET /api/profiles/:id.json          -> the four files, assembled into one document
 *   GET /api/profiles/:id/:part.json    -> a single file (feeds the Config Studio tabs)
 *
 * The `.json` suffix lets `vite build` emit the same routes as static files, so
 * a static host (GitHub Pages) answers exactly the requests the dev server does.
 */

const PARTS = ['profile', 'theme', 'palette', 'workflow'] as const;
type Part = (typeof PARTS)[number];

const ROUTE = /^\/api\/profiles(?:\/([\w-]+))?(?:\/([\w-]+))?\.json$/;

export const configApi = (configDir = 'config/profiles'): Plugin => {
  const root = resolve(process.cwd(), configDir);
  let base = '/';

  const readJson = async (...segments: string[]) =>
    JSON.parse(await readFile(join(root, ...segments), 'utf8')) as unknown;

  const send = (res: Parameters<Connect.NextHandleFunction>[1], status: number, body: unknown) => {
    const payload = JSON.stringify(body, null, 2);
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(payload);
  };

  const listProfiles = async (): Promise<{ profiles: { id: string }[] }> => {
    try {
      return (await readJson('index.json')) as { profiles: { id: string }[] };
    } catch {
      const dirs = await readdir(root, { withFileTypes: true });
      return {
        profiles: dirs
          .filter((entry) => entry.isDirectory())
          .map((entry) => ({
            id: entry.name,
            label: entry.name,
            description: '',
            icon: 'Faders',
          })),
      };
    }
  };

  /** Assembles the four files into the single document `loadProfile()` expects. */
  const assemble = async (id: string) => {
    const [profile, theme, palette, workflow] = await Promise.all(
      PARTS.map((part) => readJson(id, `${part}.json`)),
    );
    return { ...(profile as object), theme, palette, workflow };
  };

  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    let url = (req.url ?? '').split('?')[0];
    if (url.startsWith(base)) url = `/${url.slice(base.length)}`;
    const match = ROUTE.exec(url);
    if (!match || req.method !== 'GET') return next();

    const [, id, part] = match;

    void (async () => {
      try {
        if (!id) return send(res, 200, await listProfiles());
        if (!part) return send(res, 200, await assemble(id));
        if (!PARTS.includes(part as Part)) {
          return send(res, 404, { error: `Unknown config part "${part}".` });
        }
        return send(res, 200, await readJson(id, `${part}.json`));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const status = message.includes('ENOENT') ? 404 : 500;
        send(res, status, { error: message });
      }
    })();
  };

  return {
    name: 'wb-config-api',
    configResolved: (config) => {
      base = config.base;
    },
    configureServer: (server) => void server.middlewares.use(middleware),
    configurePreviewServer: (server) => void server.middlewares.use(middleware),
    // Freeze the same routes into dist/ for static hosting.
    async generateBundle() {
      const emit = (fileName: string, body: unknown) =>
        this.emitFile({ type: 'asset', fileName, source: JSON.stringify(body, null, 2) });

      const index = await listProfiles();
      emit('api/profiles.json', index);
      for (const { id } of index.profiles) {
        emit(`api/profiles/${id}.json`, await assemble(id));
        for (const part of PARTS) {
          emit(`api/profiles/${id}/${part}.json`, await readJson(id, `${part}.json`));
        }
      }
    },
  };
};
