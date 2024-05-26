const express = require('express');
const app = express();
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const db = new sqlite3.Database(':memory:');

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Rota para servir a página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Rota para obter todas as reservas
app.get('/api/reservas', (req, res) => {
    const query = `SELECT * FROM reservas`;
    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ reservas: rows });
    });
});

db.serialize(() => {
    db.run(`CREATE TABLE reservas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        instalacao TEXT,
        data TEXT,
        hora TEXT,
        horaFinal TEXT
    )`);
});

app.post('/reservar', (req, res) => {
    const { nome, instalacao, data, hora, horaFinal } = req.body;

        // Verifica se a reserva é para daqui a menos de duas horas
        const now = new Date();
        const reservaTime = new Date(data + 'T' + hora + ':00');
        const diffInHours = (reservaTime - now) / 1000 / 60 / 60;
        if (diffInHours < 2) {
            return res.json({ success: false, message: 'Não é possível reservar um horário com menos de duas horas de antecedência' });
        }

    // Verifica o número de reservas ativas do usuário
    const checkQuery = `SELECT COUNT(*) AS count FROM reservas WHERE nome = ? AND data >= ?`;
    db.get(checkQuery, [nome, new Date().toISOString().slice(0,10)], (err, row) => {
        if (err) {
            return res.json({ success: false, message: 'Erro ao acessar o banco de dados' });
        }
        if (row.count >= 1) {
            return res.json({ success: false, message: 'Usuário já possui reserva ativa' });
        } else {
            // Se o usuário tiver menos de 3 reservas ativas, prossegue com a reserva
            const query = `SELECT COUNT(*) AS count FROM reservas WHERE instalacao = ? AND data = ? AND ((hora < ? AND horaFinal > ?) OR (hora < ? AND horaFinal >= ?) OR (hora >= ? AND hora < ?) OR (horaFinal > ? AND horaFinal <= ?))`;
            db.get(query, [instalacao, data, horaFinal, hora, horaFinal, hora, hora, horaFinal, hora, horaFinal], (err, row) => {
                if (err) {
                    return res.json({ success: false, message: 'Erro ao acessar o banco de dados' });
                }
                if (row.count > 0) {
                    return res.json({ success: false, message: 'Horário já reservado' });
                } else {
                    const insert = `INSERT INTO reservas (nome, instalacao, data, hora, horaFinal) VALUES (?, ?, ?, ?, ?)`;
                    db.run(insert, [nome, instalacao, data, hora, horaFinal], function (err) {
                        if (err) {
                            return res.json({ success: false, message: 'Erro ao inserir reserva' });
                        }
                        res.json({ success: true });
                    });
                }
            });
        }
    });
});



const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

