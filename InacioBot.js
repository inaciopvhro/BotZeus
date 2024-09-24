// BACKEND DA API
// BIBLIOTECAS UTILIZADAS PARA COMPOSIÇÃO DA API
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fileUpload = require('express-fileupload');
const { body, validationResult } = require('express-validator');
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const mysql = require('mysql2/promise');

// PORTA ONDE O SERVIÇO SERÁ INICIADO
const port = 8001;
const idClient = 'bot-Zeus';

// NUMEROS AUTORIZADOS
const permissaoBot = ["556993405268@c.us","556992102573@c.us"];

// SERVIÇO EXPRESS
app.use(express.json());
app.use(express.urlencoded({
extended: true
}));
app.use(fileUpload({
debug: true
}));
app.use("/", express.static(__dirname + "/"))

app.get('/', (req, res) => {
  res.sendFile('index.html', {
    root: __dirname
  });
});


// PARÂMETROS DO CLIENT DO WPP
const client = new Client({
  authStrategy: new LocalAuth({ clientId: idClient }),
  puppeteer: { headless: true,
  executablePath: '/usr/bin/chromium-browser',

    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // <- this one doesn't works in Windows
      '--disable-gpu'
    ] }
});

// INITIALIZE DO CLIENT DO WPP
client.initialize();

function delay(t, v) {
  return new Promise(function(resolve) {
      setTimeout(resolve.bind(null, v), t)
  });
};

const createConnection = async () => {
	return await mysql.createConnection({
		host: 'localhost',
		user: 'root',
		password: '',
		database: 'bancobot'
	});
};

const getUser = async (msgfom) => {
	const connection = await createConnection();
	const [rows] = await connection.execute('SELECT contato FROM contatos WHERE contato = ?', [msgfom]);
  delay(1000).then(async function() {
		await connection.end();
		delay(500).then(async function() {
			connection.destroy();
		});
	});
	if (rows.length > 0) return true;
	return false;
};

const setUser = async (msgfom, nome) => {
	const connection = await createConnection();
	const [rows] = await connection.execute('INSERT INTO `contatos` (`id`, `contato`, `nome`) VALUES (NULL, ?, ?)', [msgfom, nome]);
  delay(1000).then(async function() {
		await connection.end();
		delay(500).then(async function() {
			connection.destroy();
		});
	});
	if (rows.length > 0) return rows[0].contato;
	return false;
};

// EVENTOS DE CONEXÃO EXPORTADOS PARA O INDEX.HTML VIA SOCKET
io.on('connection', function(socket) {
  socket.emit('message', '© BOT-Zeus - Iniciado');
  socket.emit('qr', './bola vermelha.jpg');

client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.toDataURL(qr, (err, url) => {
      socket.emit('qr', url);
      socket.emit('message', '© BOT-Zeus QRCode recebido, aponte a câmera do seu celular!');
    });
});

client.on('ready', async () => {
  socket.emit('ready', '© BOT-Zeus Dispositivo pronto!');
  socket.emit('message', '© BOT-Zeus Dispositivo pronto!');
  socket.emit('qr', './bola verde.jpg')
  console.log('© BOT-Zeus Dispositivo pronto');
  const groups = await client.getChats()
  for (const group of groups){
    if(group.id.server.includes('g.us')){
      socket.emit('message', 'Nome: ' + group.name + ' - ID: ' + group.id._serialized.split('@')[0]);
      console.log('Nome: ' + group.name + ' - ID: ' + group.id._serialized.split('@')[0])
    }
  }
});

client.on('authenticated', () => {
    socket.emit('authenticated', '© BOT-Zeus Autenticado!');
    socket.emit('message', '© BOT-Zeus Autenticado!');
    console.log('© BOT-Zeus Autenticado');
});

client.on('auth_failure', function() {
    socket.emit('message', '© BOT-Zeus Falha na autenticação, reiniciando...');
    console.error('© BOT-Zeus Falha na autenticação');
});

client.on('change_state', state => {
  console.log('© BOT-Zeus Status de conexão: ', state );
});

client.on('disconnected', (reason) => {
  socket.emit('message', '© BOT-Zeus Cliente desconectado!');
  console.log('© BOT-Zeus Cliente desconectado', reason);
  client.initialize();
});
});

// EVENTO DE ESCUTA DE MENSAGENS RECEBIDAS PELA API
client.on('message', async msg => {
  if (msg.body === null) return;
  // REMOVER LINKS
  const chat = await client.getChatById(msg.id.remote);
  for (const participant of chat.participants) {
    if (participant.id._serialized === msg.author && participant.isAdmin) {
      return;
    }
    if ((participant.id._serialized === msg.author && !participant.isAdmin) &&
        (msg.body.toLowerCase().includes("www")
          || msg.body.toLowerCase().includes("http")
          || msg.body.toLowerCase().includes(".br")
          || msg.body.toLowerCase().includes("://")
          || msg.body.toLowerCase().includes(".com.br")
          || msg.body.toLowerCase().includes(".com"))){
      try{
        await msg.delete(true)
        await client.sendMessage(msg.from, "😎 Proibido postar links")
      } catch (e){
        console.log('© Inacio Informatica: '+e);
      }
    }
  }
});
client.on('message', async msg => {
  if (msg.body === null) return;
  // COMANDO BOT
  if (msg.body.startsWith('!ass ')) {
    // MUDAR TITULO DO GRUPO
    if (!permissaoBot.includes(msg.author || msg.from)) return msg.reply("Você não pode enviar esse comando.");
    let newSubject = msg.body.slice(5);
    client.getChats().then(chats => {
      const groups = chats.filter(chat => chat.isGroup);
      if (groups.length == 0) {
        msg.reply('Você não tem grupos.');
      }
      else {
        groups.forEach((group, i) => {
          setTimeout(function() {
            try{
              group.setSubject(newSubject);
              console.log('Assunto alterado para o grupo: ' + group.name);
            } catch(e){
              console.log('Erro ao alterar assunto do grupo: ' + group.name);
            }
          },1000 + Math.floor(Math.random() * 4000) * (i+1) )
        });
      }
    });
  }
  else if (msg.body.startsWith('!desc ')) {
    // MUDAR DESCRICAO DO GRUPO
    if (!permissaoBot.includes(msg.author || msg.from)) return msg.reply("Você não pode enviar esse comando.");
    let newDescription = msg.body.slice(6);
    client.getChats().then(chats => {
      const groups = chats.filter(chat => chat.isGroup);
      if (groups.length == 0) {
        msg.reply('Você não tem grupos.');
      }
      else {
        groups.forEach((group, i) => {
          setTimeout(function() {
            try{
              group.setDescription(newDescription);
              console.log('Descrição alterada para o grupo: ' + group.name);
            } catch(e){
              console.log('Erro ao alterar descrição do grupo: ' + group.name);
            }
          },1000 + Math.floor(Math.random() * 4000) * (i+1) )
        });
      }
    });
  }
  else if (msg.body.startsWith('!ban ')) {
  // BAN USUARIO PIRATA
  if (!permissaoBot.includes(msg.author || msg.from)) return msg.reply("Você não pode enviar esse comando.");
  let usuarioPirata = msg.body.slice(5);
  client.getChats().then(chats => {
      const groups = chats.filter(chat => chat.isGroup);
      if (groups.length == 0) {
        msg.reply('Você não tem grupos.');
      }
      else {
        groups.forEach((group, i) => {
          setTimeout(async function() {
            try {
              await group.removeParticipants([usuarioPirata + `@c.us`]);
              console.log('Participante ' + usuarioPirata + ' banido do grupo: ' + group.name);
            } catch(e){
              console.log('Participante não faz parte do grupo: ' + group.name);
            }
          },1000 + Math.floor(Math.random() * 4000) * (i+1) )
        });
      }
    });
  }
  else if (msg.body.startsWith('!fcgr')) {
    // FECHAR TODOS OS GRUPOS QUE O BOT É ADMIN;
    if (!permissaoBot.includes(msg.author || msg.from)) return msg.reply("Você não pode enviar esse comando.");
    client.getChats().then(chats => {
      const groups = chats.filter(chat => chat.isGroup);
      if (groups.length == 0) {
        msg.reply('Você não tem grupos.');
      }
      else {
        groups.forEach((group, i) => {
          setTimeout(function() {
            try {
              group.setMessagesAdminsOnly(true);
              console.log('Grupo fechado: ' + group.name);
            } catch(e){
              console.log('Erro ao fechar grupo: ' + group.name);
            }
          },1000 + Math.floor(Math.random() * 4000) * (i+1) )
        });
      }
    });
  }
  else if (msg.body.startsWith('!abrgr')) {
  //ABRIR TODOS OS GRUPOS QUE O BOT É ADMIN;
  if (!permissaoBot.includes(msg.author || msg.from)) return msg.reply("Você não pode enviar esse comando.");
  client.getChats().then(chats => {
    const groups = chats.filter(chat => chat.isGroup);
      if (groups.length == 0) {
        msg.reply('Você não tem grupos.');
      }
      else {
        groups.forEach((group, i) => {
          setTimeout(function() {
            try {
              group.setMessagesAdminsOnly(false);
              console.log('Grupo aberto: ' + group.name);
            } catch(e){
              console.log('Erro ao abrir grupo: ' + group.name);
            }
          },1000 + Math.floor(Math.random() * 4000) * (i+1) )
        });
      }
    });
  }
});

client.on('message', async msg => {
  if (msg.body === null) return;
  // MENÇÃO FANTASMA
  if (msg.body === '!avs') {
    let chat = await msg.getChat();
    if (chat.isGroup) {
      for (const participant of chat.participants) {
      if (participant.id._serialized === msg.author && participant.isAdmin) {
          const mensagem = "Fala pessoal!\n\nVocês estão prestes a acessar os códigos, ferramentas, APIs e integrações gratuitas que eu aplico nos meus negócios para vender e realizar atendimentos no Whatsapp, de forma automatizada.\n\n👉 https://comunidadezdg.com.br/\n\nAbraços, te vejo na Comunidade ZDG!"
          try {const serializedArray = chat.participants.map(({ id: { _serialized } }) => _serialized);
              client.sendMessage(msg.from, mensagem, {mentions: serializedArray})      
      } catch (e){console.log('© Inacio Informatica: '+ e)}
      }}}}

});

// EVENTO DE ESCUTA DE MENSAGENS ENVIADAS PELA API
client.on('message_create', async msg => {
  if (msg.body === '!att') {
      let chat = await msg.getChat();
      if (chat.isGroup) {
        const mensagem = "*NOVO LANÇAMENTO• 10$*\n\n🖤🎰 LINHA KF 🎰🖤\n\n👉https://www.kfsvv.com/?id=458387738&currency=BRL&type=2https://www.kfsvv.com/?id=458387738&currency=BRL&type=2https://www.kfsvv.com/?id=458387738&currency=BRL&type=2\n\nBoa Sorte!"
        const imagem = MessageMedia.fromFilePath('./escorpiao.jpg');
        
        try{
          const serializedArray = chat.participants.map(({ id: { _serialized } }) => _serialized);
          client.sendMessage(msg.to, imagem, {caption: mensagem}, {mentions: serializedArray});
         } catch (e){
          console.log('© Inacio Informatica: '+e)
        }
      }
  }
  if (msg.body === '!pdr'){
    const chat = await client.getChatById(msg.id.remote);
    const text = (await msg.getQuotedMessage()).body;
    let mentions = [];
    for(let participant of chat.participants) {
      if (participant.id._serialized === msg.author && !participant.isAdmin) 
        return msg.reply("Você não pode enviar esse comando.");
      try{
        const contact = await client.getContactById(participant.id._serialized);
        mentions.push(contact);
        } catch (e)
          {console.log('© Bot Inacio: '+e);}
      }
      console.log(text)
      await chat.sendMessage(text, { mentions: mentions });
  }
});

// EVENTO DE NOVO USUÁRIO EM GRUPO
client.on('group_join', async (notification) => {
  // LISTAR GRUPOS
  const groups = await client.getChats()
  console.log('-----------------------------\nBOT-ZDG Grupos atualizados:\n-----------------------------')
  try{
    for (const group of groups){
      if(group.id.server.includes('g.us')){
        console.log('Nome: ' + group.name + ' - ID: ' + group.id._serialized.replace(/\D/g,''))
      }
    }
  } catch (e){
    console.log('© Comunidade ZDG')
  }

  // GRAVAR USUÁRIOS DO GRUPOS
  try{
    const contact = await client.getContactById(notification.id.participant)
    const nomeContato = (contact.pushname === undefined) ? contact.verifiedName : contact.pushname;
    const user = notification.id.participant.replace(/\D/g, '');
    const getUserFrom = await getUser(user);

    if (getUserFrom === false) {
      await setUser(user, nomeContato);
      console.log('Usuário armazenado: ' + user + ' - ' + nomeContato)
    }

    if (getUserFrom !== false) {
      console.log('Usuário já foi armazenado')
    }
  }
  catch(e){
    console.log('Não foi possível armazenar o usuário' + e)
  }  

  // MENSAGEM DE SAUDAÇÃO
  if (notification.id.remote) {
    const contact = await client.getContactById(notification.id.participant)
    const texto1 = ', tudo bem? Seja bem vindo ao grupo de dicas e estrategias de jogos. \n\n👉 *Dicas*: Dicas das melhores plataformas\n👉 *Horarios Pagantes*: Sempre informando os melhores horarios\n\nPs.: 🔞 Proibidos para menores de 18 anos\n\nJOGUE COM RESPONSABILIDADE\n\nBoa Sorte';
    const textos = [texto1];

    const mensagemTexto = `@${contact.number}!` + textos;
    const chat = await client.getChatById(notification.id.remote);

    console.log('Grupo: ' + notification.id.remote + ' - Mensagem: ' + mensagemTexto);

    delay(1000).then(async function() {
      try {
        chat.sendStateTyping();
      } catch(e){
        console.log('© Inacio Informatica: '+e)
      }
    });

    delay(5000).then(async function() {
      try{
        client.sendMessage(notification.id.remote, mensagemTexto, { mentions: [contact] });
        chat.clearState();
      } catch(e){
        console.log('© Comunidade ZDG')
      }
    });
  }

});


// POST text-message
app.post('/text-message', [
  body('group').notEmpty(),
  body('message').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({
    msg
  }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  const group = req.body.group + "@g.us";
  const message = req.body.message;

  try {
    client.sendMessage(group, message).then(response => {
    res.status(200).json({
      status: true,
      message: 'Mensagem enviada',
      response: response
    });
    }).catch(e => {
    res.status(500).json({
      status: false,
      message: 'Mensagem não enviada',
      response: e
    });
    });
  } catch(e) {
    console.log('Erro: ' + e)
  }
});

// POST media-message-url
app.post('/media-message-url', [
  body('group').notEmpty(),
  body('caption').notEmpty(),
  body('url').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({
    msg
  }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  const group = req.body.group + "@g.us";
  const cap = req.body.caption;
  const media = await MessageMedia.fromUrl(req.body.url);

  try {
    client.sendMessage(group, media, {caption: cap}).then(response => {
    res.status(200).json({
      status: true,
      message: 'Mensagem enviada',
      response: response
    });
    }).catch(e => {
    res.status(500).json({
      status: false,
      message: 'Mensagem não enviada',
      response: e
    });
    });
  } catch(e) {
    console.log('Erro: ' + e)
  }
});

// POST media-message-path
app.post('/media-message-path', [
  body('group').notEmpty(),
  body('caption').notEmpty(),
  body('path').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({
    msg
  }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  const group = req.body.group + "@g.us";
  const cap = req.body.caption;
  const media = MessageMedia.fromFilePath(req.body.path);

  try {
    client.sendMessage(group, media, {caption: cap}).then(response => {
    res.status(200).json({
      status: true,
      message: 'Mensagem enviada',
      response: response
    });
    }).catch(e => {
    res.status(500).json({
      status: false,
      message: 'Mensagem não enviada',
      response: e
    });
    });
  } catch(e) {
    console.log('Erro: ' + e)
  }
});

// POST record-url
app.post('/record-url', [
  body('group').notEmpty(),
  body('url').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({
    msg
  }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  const group = req.body.group + "@g.us";
  const media = await MessageMedia.fromUrl(req.body.url);

  try {
    client.sendMessage(group, media, {sendAudioAsVoice: true}).then(response => {
    res.status(200).json({
      status: true,
      message: 'Mensagem enviada',
      response: response
    });
    }).catch(e => {
    res.status(500).json({
      status: false,
      message: 'Mensagem não enviada',
      response: e
    });
    });
  } catch(e) {
    console.log('Erro: ' + e)
  }
});

// POST record-path
app.post('/record-path', [
  body('group').notEmpty(),
  body('path').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({
    msg
  }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  const group = req.body.group + "@g.us";
  const media = MessageMedia.fromFilePath(req.body.path);

  try {
    client.sendMessage(group, media, {sendAudioAsVoice: true}).then(response => {
    res.status(200).json({
      status: true,
      message: 'Mensagem enviada',
      response: response
    });
    }).catch(e => {
    res.status(500).json({
      status: false,
      message: 'Mensagem não enviada',
      response: e
    });
    });
  } catch(e) {
    console.log('Erro: ' + e)
  }
});

// POST add-user
app.post('/add-user', [
  body('user').notEmpty(),
  body('group').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({
    msg
  }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  const user = req.body.user.replace(/\D/g,'');
  const group = req.body.group + "@g.us";

  try {
    const chat = await client.getChatById(group);
    console.log('Adicionando ' + user + ' ao grupo ' + group)
      const numberDDI = user.substr(0, 2);
      const numberDDD = user.substr(2, 2);
      const numberUser = user.substr(-8, 8);
      if (numberDDI !== "55") {
        const numberZeus = user + "@c.us";
        await chat.addParticipants([numberZeus])
      }
      else if (numberDDI === "55" && parseInt(numberDDD) <= 30) {
        const numberZeus = "55" + numberDDD + "9" + numberUser + "@c.us";
        await chat.addParticipants([numberZeus])
      }
      else if (numberDDI === "55" && parseInt(numberDDD) > 30) {
        const numberZeus = "55" + numberDDD + numberUser + "@c.us";
        await chat.addParticipants([numberZeus])
      }
      return res.status(200).json({
        status: true,
        message: 'BOT-Zeus: ' + user + ' adicionado',
      });
  } catch(e){
    res.status(500).json({
      status: false,
      message: 'Usuário não adicionado.',
      response: e
    });
  }
});

// POST remove-user
app.post('/remove-user', [
  body('user').notEmpty(),
  body('group').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({
    msg
  }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  const user = req.body.user.replace(/\D/g,'');
  const group = req.body.group + "@g.us";

  try {
    const chat = await client.getChatById(group);
    console.log('Removendo ' + user + ' do grupo ' + group)
      const numberDDI = user.substr(0, 2);
      const numberDDD = user.substr(2, 2);
      const numberUser = user.substr(-8, 8);
      if (numberDDI !== "55") {
        const numberZeus = user + "@c.us";
        await chat.removeParticipants([numberZeus])
      }
      else if (numberDDI === "55" && parseInt(numberDDD) <= 30) {
        const numberZeus = "55" + numberDDD + "9" + numberUser + "@c.us";
        await chat.removeParticipants([numberZeus])
      }
      else if (numberDDI === "55" && parseInt(numberDDD) > 30) {
        const numberZeus = "55" + numberDDD + numberUser + "@c.us";
        await chat.removeParticipants([numberZeus])
      }
      return res.status(200).json({
        status: true,
        message: 'BOT-Zeus: ' + user + ' removido',
      });
  } catch(e){
    res.status(500).json({
      status: false,
      message: 'Usuário não removido.',
      response: e
    });
  }
});

// INITIALIZE DO SERVIÇO
server.listen(port, function() {
  console.log('© Bot Zeus - Aplicativo rodando na porta *: ' + port);
});