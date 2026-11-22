const express = require('express');
const mysql = require('mysql2/promise');
const { createClient } = require('redis');

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_NAME = process.env.DB_NAME || 'loja_db';
const DB_USER = process.env.DB_USER || 'rafael_user';
const DB_PASSWORD = process.env.DB_PASSWORD || 'senha_segura_aqui';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);

const CACHE_KEY = 'produtos:all';

let pool;
let redisClient;
let dbReady = false;
let redisReady = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function initMySQL() {
  while (!dbReady) {
    try {
      pool = mysql.createPool({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });

      const conn = await pool.getConnection();
      await conn.query(`
        CREATE TABLE IF NOT EXISTS produtos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nome VARCHAR(120) NOT NULL,
          preco DECIMAL(10, 2) NOT NULL,
          estoque INT NOT NULL DEFAULT 0,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      conn.release();
      dbReady = true;
      console.log(`MySQL conectado em ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
    } catch (err) {
      console.error('Aguardando MySQL...', err.message);
      await sleep(3000);
    }
  }
}

async function initRedis() {
  redisClient = createClient({
    socket: {
      host: REDIS_HOST,
      port: REDIS_PORT,
      reconnectStrategy: (retries) => Math.min(retries * 500, 3000),
    },
  });

  redisClient.on('ready', () => {
    redisReady = true;
    console.log(`Redis conectado em ${REDIS_HOST}:${REDIS_PORT}`);
  });

  redisClient.on('error', (err) => {
    redisReady = false;
    console.error('Erro no Redis:', err.message);
  });

  while (!redisReady) {
    try {
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }
      if (redisClient.isOpen) {
        redisReady = true;
      }
    } catch (err) {
      console.error('Aguardando Redis...', err.message);
      await sleep(3000);
    }
  }
}

app.get('/', (req, res) => {
  res.json({
    servico: 'Loja API',
    autor: 'Rafael Gabriel',
    status: 'online',
    rotas: ['/health', '/ready', '/produtos'],
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', autor: 'Rafael Gabriel', uptime: process.uptime() });
});

app.get('/ready', async (req, res) => {
  try {
    if (!pool || !redisClient?.isOpen) {
      return res.status(503).json({ status: 'not_ready', db: false, redis: false });
    }
    await pool.query('SELECT 1');
    await redisClient.ping();
    return res.status(200).json({ status: 'ready', db: true, redis: true });
  } catch (err) {
    return res.status(503).json({
      status: 'not_ready',
      error: err.message,
    });
  }
});

app.get('/produtos', async (req, res) => {
  try {
    if (redisClient?.isOpen) {
      const cached = await redisClient.get(CACHE_KEY);
      if (cached) {
        return res.json({ source: 'cache', data: JSON.parse(cached) });
      }
    }

    const [rows] = await pool.query(
      'SELECT id, nome, preco, estoque, criado_em FROM produtos ORDER BY id DESC'
    );

    if (redisClient?.isOpen) {
      await redisClient.set(CACHE_KEY, JSON.stringify(rows), { EX: 30 });
    }

    return res.json({ source: 'database', data: rows });
  } catch (err) {
    console.error('Erro ao buscar produtos:', err);
    return res.status(500).json({ erro: 'Falha ao consultar produtos' });
  }
});

app.post('/produtos', async (req, res) => {
  const { nome, preco, estoque = 0 } = req.body;

  if (!nome || typeof nome !== 'string' || nome.trim() === '') {
    return res.status(400).json({ erro: 'Campo "nome" é obrigatório' });
  }

  const precoNum = Number(preco);
  const estoqueNum = Number(estoque);

  if (Number.isNaN(precoNum) || precoNum < 0) {
    return res.status(400).json({ erro: 'Campo "preco" deve ser um número >= 0' });
  }

  if (!Number.isInteger(estoqueNum) || estoqueNum < 0) {
    return res.status(400).json({ erro: 'Campo "estoque" deve ser um inteiro >= 0' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO produtos (nome, preco, estoque) VALUES (?, ?, ?)',
      [nome.trim(), precoNum, estoqueNum]
    );

    if (redisClient?.isOpen) {
      await redisClient.del(CACHE_KEY);
    }

    const [criado] = await pool.query(
      'SELECT id, nome, preco, estoque, criado_em FROM produtos WHERE id = ?',
      [result.insertId]
    );

    return res.status(201).json(criado[0]);
  } catch (err) {
    console.error('Erro ao cadastrar produto:', err);
    return res.status(500).json({ erro: 'Falha ao cadastrar produto' });
  }
});

async function start() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Loja API (Rafael Gabriel) rodando na porta ${PORT}`);
  });

  await Promise.all([initMySQL(), initRedis()]);
}

start();
