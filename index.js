// index.js
require('dotenv').config();

const express = require('express');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { createClient } = require('@supabase/supabase-js');
const swaggerUi = require('swagger-ui-express');

const app = express();
app.set('trust proxy', true);

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────
const PORT = Number(process.env.PORT || 3000);
const API = normalizeBase(process.env.API || '/api'); // e.g. '/api'
const NODE_ENV = process.env.NODE_ENV || 'development';
const SERVER_PUBLIC_URL = (process.env.SERVER_PUBLIC_URL || '').replace(/\/+$/,'');
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

// Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_ROLE);
const dbAnon = ANON_KEY ? createClient(SUPABASE_URL, ANON_KEY) : null;

// ─────────────────────────────────────────────
// Body parsing
// ─────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// Helpful 400 for invalid JSON
app.use((err, _req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON format' }
    });
  }
  next(err);
});

// ─────────────────────────────────────────────
// CORS: allow ALL origins (credentials-friendly) + universal preflight
// ─────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    // Non-browser tools (no Origin)
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Log requests (after CORS so OPTIONS 204s still log)
app.use((req, _res, next) => { console.log(`${req.method} ${req.url}`); next(); });

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function normalizeBase(s) {
  if (!s.startsWith('/')) s = '/' + s;
  if (s.length > 1) s = s.replace(/\/+$/,'');
  return s;
}
const ok  = (res, data = null, message = 'OK', status = 200) =>
  res.status(status).json({ success: true, message, data });
const bad = (res, status, code, message, details) =>
  res.status(status).json({ success: false, error: { code, message, details } });
const ah  = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function auth(req, res, next) {
  const token = (req.headers.authorization || '').split(' ')[1];
  if (!token) return bad(res, 401, 'UNAUTHORIZED', 'Authentication required');
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch (e) { return bad(res, 403, 'INVALID_TOKEN', 'Invalid or expired token', e?.message); }
}

// ─────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────
const perfSchema = Joi.object({
  performance_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  points: Joi.number().integer().min(0).default(0),
  assists: Joi.number().integer().min(0).default(0),
  rebounds: Joi.number().integer().min(0).default(0),
  steals: Joi.number().integer().min(0).default(0),
  blocks: Joi.number().integer().min(0).default(0),
  turnovers: Joi.number().integer().min(0).default(0),
  fouls: Joi.number().integer().min(0).default(0),
  minutes_played: Joi.number().integer().min(0).default(0),
  field_goal_pct: Joi.number().min(0).max(100).allow(null),
  three_point_pct: Joi.number().min(0).max(100).allow(null),
  free_throw_pct: Joi.number().min(0).max(100).allow(null),
  efficiency_rating: Joi.number().precision(2).allow(null),
  overall_score: Joi.number().min(0).max(10).precision(2).allow(null),
});

const playerCreateSchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
  position: Joi.string().max(10).allow('', null),
  age: Joi.number().integer().min(0).allow(null),
  height_cm: Joi.number().integer().min(0).allow(null),
  weight_kg: Joi.number().integer().min(0).allow(null),
  nationality: Joi.string().max(100).allow('', null),
  image_url: Joi.string().uri().allow('', null),
  is_active: Joi.boolean().default(true),
  notes: Joi.string().allow('', null),
  performances: Joi.array().items(perfSchema).default([]),
});

const playerUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(200),
  position: Joi.string().max(10).allow('', null),
  age: Joi.number().integer().min(0).allow(null),
  height_cm: Joi.number().integer().min(0).allow(null),
  weight_kg: Joi.number().integer().min(0).allow(null),
  nationality: Joi.string().max(100).allow('', null),
  image_url: Joi.string().uri().allow('', null),
  is_active: Joi.boolean(),
  notes: Joi.string().allow('', null),
}).min(1);

const signupSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(100).pattern(/[A-Z]/).pattern(/[a-z]/).pattern(/[0-9]/).required(),
  name: Joi.string().min(2).max(100).required(),
});
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(100).required(),
});

// ─────────────────────────────────────────────
// Swagger (programmatic, relative `/api` + optional absolute)
// ─────────────────────────────────────────────
const swaggerServers = [{ url: API, description: 'Relative base (same origin)' }];
if (SERVER_PUBLIC_URL) swaggerServers.push({ url: `${SERVER_PUBLIC_URL}${API}`, description: 'Absolute (env)' });

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'NBA Players and Turfs API',
    version: '1.0.0',
    description: 'Auth + Players (with nested performances) + Turfs (read-only)',
  },
  servers: swaggerServers,
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      SignupBody: { type: 'object', required:['email','password','name'],
        properties:{ email:{type:'string',format:'email'}, password:{type:'string'}, name:{type:'string'} } },
      LoginBody: { type:'object', required:['email','password'],
        properties:{ email:{type:'string',format:'email'}, password:{type:'string'} } },
      Performance: { type:'object', required:['performance_date'],
        properties:{ performance_date:{type:'string',example:'2025-10-01'}, points:{type:'integer'}, assists:{type:'integer'},
          rebounds:{type:'integer'}, steals:{type:'integer'}, blocks:{type:'integer'}, turnovers:{type:'integer'},
          fouls:{type:'integer'}, minutes_played:{type:'integer'}, field_goal_pct:{type:'number'},
          three_point_pct:{type:'number'}, free_throw_pct:{type:'number'}, efficiency_rating:{type:'number'},
          overall_score:{type:'number'} } },
      PlayerCreate: { type:'object', required:['name'],
        properties:{ name:{type:'string'}, position:{type:'string'}, age:{type:'integer'},
          height_cm:{type:'integer'}, weight_kg:{type:'integer'}, nationality:{type:'string'},
          image_url:{type:'string'}, is_active:{type:'boolean'}, notes:{type:'string'},
          performances:{type:'array',items:{ $ref:'#/components/schemas/Performance' }} } },
      Player: { allOf: [
        { $ref:'#/components/schemas/PlayerCreate' },
        { type:'object', properties:{ id:{type:'string',format:'uuid'}, created_at:{type:'string',format:'date-time'}, updated_at:{type:'string',format:'date-time'} } }
      ]},
      PlayerUpdateBody: { allOf: [
        { $ref:'#/components/schemas/PlayerCreate' },
        { type:'object', properties:{
          performances_replace:{type:'array',items:{ $ref:'#/components/schemas/Performance' }},
          performances_append:{type:'array',items:{ $ref:'#/components/schemas/Performance' }},
        } }
      ]},
    },
  },
  // Paths are relative to `servers[].url`, so leave off the /api prefix here.
  paths: {
    '/': { get: { tags:['System'], summary:'API index', responses:{ '200':{description:'OK'} } } },
    '/auth/signup': { post: {
      tags:['Auth'], summary:'Signup and receive API JWT',
      requestBody:{ required:true, content:{ 'application/json':{ schema:{ $ref:'#/components/schemas/SignupBody' }}}},
      responses:{ '200':{description:'Signup successful'} } } },
    '/auth/login': { post: {
      tags:['Auth'], summary:'Login and receive API JWT',
      requestBody:{ required:true, content:{ 'application/json':{ schema:{ $ref:'#/components/schemas/LoginBody' }}}},
      responses:{ '200':{description:'Login successful'} } } },
    '/me': { get: { tags:['Auth'], summary:'Current user', security:[{ bearerAuth:[] }],
      responses:{ '200':{description:'Returns id/email from token'} } } },

    '/players': {
      get: { tags:['Players'], summary:'List players', security:[{ bearerAuth:[] }],
        responses:{ '200':{description:'Players fetched'} } },
      post: { tags:['Players'], summary:'Create player', security:[{ bearerAuth:[] }],
        requestBody:{ required:true, content:{ 'application/json':{ schema:{ $ref:'#/components/schemas/PlayerCreate' }}}},
        responses:{ '201':{description:'Player created'} } },
    },
    '/players/{id}': {
      get: { tags:['Players'], summary:'Get player by id', security:[{ bearerAuth:[] }],
        parameters:[
          { in:'path', name:'id', required:true, schema:{ type:'string', format:'uuid' } },
          { in:'query', name:'days', schema:{ type:'integer', example:30 } }
        ], responses:{ '200':{description:'Player'}, '404':{description:'Not found'} } },
      put: { tags:['Players'], summary:'Update player', security:[{ bearerAuth:[] }],
        parameters:[ { in:'path', name:'id', required:true, schema:{ type:'string', format:'uuid' } } ],
        requestBody:{ required:true, content:{ 'application/json':{ schema:{ $ref:'#/components/schemas/PlayerUpdateBody' }}}},
        responses:{ '200':{description:'Player updated'} } },
      delete: { tags:['Players'], summary:'Delete player', security:[{ bearerAuth:[] }],
        parameters:[ { in:'path', name:'id', required:true, schema:{ type:'string', format:'uuid' } } ],
        responses:{ '200':{description:'Player deleted'} } },
    },

    '/turfs': { get: { tags:['Turfs'], summary:'List turfs (read-only)', security:[{ bearerAuth:[] }],
      responses:{ '200':{description:'Turfs fetched'} } } },
    '/turfs/{id}': { get: { tags:['Turfs'], summary:'Get turf by id', security:[{ bearerAuth:[] }],
      parameters:[ { in:'path', name:'id', required:true, schema:{ type:'string', format:'uuid' } } ],
      responses:{ '200':{description:'Turf'}, '404':{description:'Not found'} } } },
  },
};

app.use(`${API}/docs`, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─────────────────────────────────────────────
// Routes (mounted once under /api)
// ─────────────────────────────────────────────
const r = express.Router();

// index
r.get('/', (_req, res) =>
  ok(res, {
    auth: ['POST /auth/signup', 'POST /auth/login', 'GET /me'],
    players: ['GET /players', 'POST /players', 'GET /players/:id?days=30', 'PUT /players/:id', 'DELETE /players/:id'],
    turfs_readonly: ['GET /turfs', 'GET /turfs/:id'],
    docs: '/docs',
  }, 'NBA Players API')
);

// auth
r.post('/auth/signup', ah(async (req, res) => {
  const { error } = signupSchema.validate(req.body);
  if (error) return bad(res, 400, 'VALIDATION_ERROR', error.details[0].message);
  if (!dbAnon) return bad(res, 500, 'CONFIG', 'Anon key missing');

  const { email, password, name } = req.body;
  const { data, error: signErr } = await dbAnon.auth.signUp({
    email, password, options: { data: { full_name: name } }
  });
  if (signErr) return bad(res, 400, 'SIGNUP_FAILED', signErr.message);

  const token = jwt.sign({ id: data.user.id, email, role: 'USER' }, JWT_SECRET, { expiresIn: '3h' });
  return ok(res, { token, user: { id: data.user.id, email, name } }, 'Signup successful');
}));

r.post('/auth/login', ah(async (req, res) => {
  const { error } = loginSchema.validate(req.body);
  if (error) return bad(res, 400, 'VALIDATION_ERROR', error.details[0].message);

  const { email, password } = req.body;
  const clientForAuth = dbAnon || db;
  const { data, error: authErr } = await clientForAuth.auth.signInWithPassword({ email, password });
  if (authErr || !data?.user) return bad(res, 401, 'INVALID_CREDENTIALS', authErr?.message || 'Invalid credentials');

  const token = jwt.sign({ id: data.user.id, email: data.user.email, role: 'USER' }, JWT_SECRET, { expiresIn: '3h' });
  return ok(res, { token, user: { id: data.user.id, email: data.user.email } }, 'Login successful');
}));

r.get('/me', auth, ah(async (req, res) =>
  ok(res, { id: req.user.id, email: req.user.email, role: 'USER' }, 'Me')
));

// players
r.get('/players', auth, ah(async (_req, res) => {
  const { data, error } = await db.from('nba_players').select('*').order('created_at', { ascending: false });
  if (error) return bad(res, 500, 'DB', error.message);
  return ok(res, data, 'Players fetched');
}));

r.post('/players', auth, ah(async (req, res) => {
  const { error, value } = playerCreateSchema.validate(req.body, { stripUnknown: true });
  if (error) return bad(res, 400, 'VALIDATION', error.details[0].message);

  const payload = { ...value, performances: Array.isArray(value.performances) ? value.performances : [] };
  const { data, error: dberr } = await db.from('nba_players').insert([payload]).select();
  if (dberr) return bad(res, 500, 'DB', dberr.message);
  return ok(res, data?.[0] ?? null, 'Player created', 201);
}));

r.get('/players/:id', auth, ah(async (req, res) => {
  const days = req.query.days ? Math.max(1, Math.min(365, parseInt(req.query.days, 10))) : null;
  const { data, error } = await db.from('nba_players').select('*').eq('id', req.params.id).maybeSingle();
  if (error) return bad(res, 500, 'DB', error.message);
  if (!data) return bad(res, 404, 'NOT_FOUND', 'Player not found');

  if (days) {
    const from = new Date(); from.setDate(from.getDate() - days);
    const fromStr = from.toISOString().slice(0, 10);
    const perf = Array.isArray(data.performances) ? data.performances : [];
    data.performances = perf
      .filter(p => (p.performance_date || '') >= fromStr)
      .sort((a,b) => a.performance_date < b.performance_date ? 1 : -1);
  }
  return ok(res, data, 'Player fetched');
}));

r.put('/players/:id', auth, ah(async (req, res) => {
  const schema = playerUpdateSchema.keys({
    performances_replace: Joi.array().items(perfSchema),
    performances_append:  Joi.array().items(perfSchema),
  }).min(1);

  const { error, value } = schema.validate(req.body, { stripUnknown: true });
  if (error) return bad(res, 400, 'VALIDATION', error.details[0].message);

  const { data: existing, error: exErr } = await db.from('nba_players').select('*').eq('id', req.params.id).maybeSingle();
  if (exErr) return bad(res, 500, 'DB', exErr.message);
  if (!existing) return bad(res, 404, 'NOT_FOUND', 'Player not found');

  const updates = { ...value, updated_at: new Date().toISOString() };
  delete updates.performances_replace;
  delete updates.performances_append;

  if (req.body.performances_replace) {
    updates.performances = req.body.performances_replace;
  } else if (req.body.performances_append) {
    const current = Array.isArray(existing.performances) ? existing.performances : [];
    const map = new Map(current.map(p => [p.performance_date, p]));
    for (const p of req.body.performances_append) {
      map.set(p.performance_date, { ...(map.get(p.performance_date) || {}), ...p });
    }
    updates.performances = Array.from(map.values());
  }

  const { data, error: dberr } = await db.from('nba_players').update(updates).eq('id', req.params.id).select();
  if (dberr) return bad(res, 500, 'DB', dberr.message);
  if (!data?.length) return bad(res, 404, 'NOT_FOUND', 'Player was not found');
  return ok(res, data[0], 'Player updated');
}));

r.delete('/players/:id', auth, ah(async (req, res) => {
  const { error } = await db.from('nba_players').delete().eq('id', req.params.id);
  if (error) return bad(res, 500, 'DB', error.message);
  return ok(res, null, 'Player deleted');
}));

// turfs
r.get('/turfs', auth, ah(async (_req, res) => {
  const { data, error } = await db.from('turfs').select('*').order('created_at', { ascending: false });
  if (error) return bad(res, 500, 'DB', error.message);
  return ok(res, data, 'Turfs fetched');
}));

r.get('/turfs/:id', auth, ah(async (req, res) => {
  const { data, error } = await db.from('turfs').select('*').eq('id', req.params.id).maybeSingle();
  if (error) return bad(res, 500, 'DB', error.message);
  if (!data) return bad(res, 404, 'NOT_FOUND', 'Turf not found');
  return ok(res, data, 'Turf fetched');
}));

// mount under /api
app.use(API, r);

// 404 and error handler
app.use((req, res) => bad(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  return bad(res, 500, 'SERVER_ERROR', 'Something went wrong',
    NODE_ENV === 'development' ? err.stack : undefined);
});

// Startup
const displayBase = SERVER_PUBLIC_URL ? `${SERVER_PUBLIC_URL}${API}` : `http://localhost:${PORT}${API}`;
app.listen(PORT, () => {
  console.log(`✅ Env: ${NODE_ENV}`);
  console.log(`✅ API base: ${displayBase}`);
  console.log(`📖 Swagger: ${(SERVER_PUBLIC_URL || `http://localhost:${PORT}`)}${API}/docs`);
});
