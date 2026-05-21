const {
  Client,
  GatewayIntentBits,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  PermissionsBitField,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const { MercadoPagoConfig, Payment } = require("mercadopago");
const express = require("express");
const fs = require("fs");

const app = express();
app.use(express.json());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.TOKEN;
const MP_TOKEN = process.env.MP_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const CATEGORIA_ID = "1466619720487800845";
const CANAL_RECENTES = "1494137996612472943";
const CANAL_RANK = "1490184769831698655";
const CANAL_LOGS = "1488589113954271282";
const CARGO_CLIENTE = "1494143094327742594";

const IMG = "https://cdn.discordapp.com/attachments/1373392385014370334/1497072312413851790/1294723.webp";

const EMBED_PAINEL = "https://cdn.discordapp.com/attachments/1504981948106408182/1506132172321460294/8a0b88a4-3ee0-442f-ad5f-760341da1179.png";

const EMBED_SENSI = "https://cdn.discordapp.com/attachments/1504981948106408182/1506141414252089484/content.png";

const EMBED_GTA = "https://cdn.discordapp.com/attachments/1504981948106408182/1506140642089242644/59f6df83-2b8d-4044-87de-3191a5146e6c.png";

let db = {
  tickets: {},
  pix: {},
  entregues: {},
  vendas: {},
  rankMsg: null,
  cooldown: {},
  blacklist: {}
};

if (fs.existsSync("dados.json")) {
  db = JSON.parse(fs.readFileSync("dados.json"));
}

function salvar() {
  fs.writeFileSync("dados.json", JSON.stringify(db, null, 2));
}

const mp = new MercadoPagoConfig({
  accessToken: MP_TOKEN
});

const payment = new Payment(mp);

const PRODUTOS = {

  opt5: {
    nome: "Otimização Básica",
    preco: 5,
    link: "https://www.mediafire.com/file/vb4klwyfxmxt5sa/OTIMIZA%25C3%2587%25C3%2583O_BASICA.rar/file"
  },

  opt10: {
    nome: "Otimização Avançada",
    preco: 10,
    link: "https://www.mediafire.com/file/iidtoou88ozkwll/OTIMIZA%25C3%2587%25C3%2583O_AVAN%25C3%2587ADA.rar/file"
  },

  opt20: {
    nome: "Otimização Suprema",
    preco: 20,
    link: "https://www.mediafire.com/file/61ivdjr64yb9o6t/OTIMIZI%25C3%2587%25C3%2583O_SUPREMA.rar/file"
  },

  omega: {
    nome: "Otimização Omega",
    preco: 35,
    link: "https://www.mediafire.com/file/dlrwhlg55bs24yd/OMEGA+PACk.rar/file"
  },

  sensi: {
    nome: "Pack Sensi",
    preco: 5,
    link: "https://www.mediafire.com/file/n9ykc869wesglg0/PACK+SENSI+DIDDY.rar/file",
    imagem: EMBED_SENSI
  },

  fivem: {
    nome: "Pack FiveM",
    preco: 10,
    link: "https://www.mediafire.com/file/5yirnjceinkjoaf/pack+fivem.rar/file"
  },

  gta: {
    nome: "Conta GTA V",
    preco: 5,
    tipo: "gta",
    imagem: EMBED_GTA
  }
};

const CONTAS_GTA = [
  "PODTOPTAP:dream282521",
  "gta19710559:85sJzrKnu",
  "vykl99911:Leng123?",
  "finnickloveschrismas:10011990t",
  "halotic21:Ddjac210392",
  "msfaraz69:blj55566"
];

const commands = [

  new SlashCommandBuilder()
    .setName("painel")
    .setDescription("Enviar painel principal"),

  new SlashCommandBuilder()
    .setName("painelsensi")
    .setDescription("Enviar painel do pack sensi"),

  new SlashCommandBuilder()
    .setName("painelgta")
    .setDescription("Enviar painel GTA"),

  new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Ver ranking")

].map(cmd => cmd.toJSON());

client.once("ready", async () => {

  console.log("✅ BOT ONLINE");

  const rest = new REST({ version: "10" })
    .setToken(TOKEN);

  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );

  console.log("✅ Slash Commands registradas");

});

function contaGtaRandom() {
  return CONTAS_GTA[
    Math.floor(Math.random() * CONTAS_GTA.length)
  ];
}

async function gerarPix(produtoId, userId) {

  try {

    const produto = PRODUTOS[produtoId];

    return await payment.create({
      body: {
        transaction_amount: Number(produto.preco),
        description: produto.nome,
        payment_method_id: "pix",

        payer: {
          email: `user${userId}@gmail.com`
        },

        metadata: {
          user_id: userId,
          produto: produtoId
        }
      }
    });

  } catch (e) {
    console.log(e);
    return null;
  }
}

async function atualizarRank() {

  try {

    const canal =
      await client.channels.fetch(CANAL_RANK);

    const ranking = Object.entries(db.vendas)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map((x, i) =>
        `${i + 1}. <@${x[0]}> - ${x[1]} compras`
      )
      .join("\n") || "Sem compras ainda";

    if (!db.rankMsg) {

      const msg =
        await canal.send("Carregando rank...");

      db.rankMsg = msg.id;
      salvar();
    }

    const msg =
      await canal.messages.fetch(db.rankMsg);

    await msg.edit(
      `🏆 **TOP COMPRADORES**\n\n${ranking}`
    );

  } catch (e) {
    console.log(e);
  }
}

client.on("interactionCreate", async (i) => {

  if (i.isChatInputCommand()) {

    if (i.commandName === "painel") {

      const embed = new EmbedBuilder()
        .setTitle("🛒 DIDDY STORE")
        .setDescription(
`🔥 Loja oficial de otimizações

💻 Melhor desempenho
⚡ Mais FPS
🎯 Menor input delay`
        )
        .setImage(EMBED_PAINEL)
        .setColor("Purple");

      return i.reply({
        embeds: [embed],

        components: [

          new ActionRowBuilder().addComponents(

            new ButtonBuilder()
              .setCustomId("opt5")
              .setLabel("BÁSICA")
              .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
              .setCustomId("opt10")
              .setLabel("AVANÇADA")
              .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
              .setCustomId("opt20")
              .setLabel("SUPREMA")
              .setStyle(ButtonStyle.Danger),

            new ButtonBuilder()
              .setCustomId("omega")
              .setLabel("OMEGA")
              .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
              .setCustomId("fivem")
              .setLabel("FIVEM")
              .setStyle(ButtonStyle.Secondary)
          ),

          new ActionRowBuilder().addComponents(

            new ButtonBuilder()
              .setCustomId("gta")
              .setLabel("GTA V")
              .setStyle(ButtonStyle.Danger),

            new ButtonBuilder()
              .setCustomId("sensi")
              .setLabel("PACK SENSI")
              .setStyle(ButtonStyle.Success)
          )
        ]
      });
    }

    if (i.commandName === "painelsensi") {

      const embed = new EmbedBuilder()
        .setTitle("🎯 PACK SENSI")
        .setDescription(
`🔥 Melhor pack de sensi

🎯 Mais precisão
⚡ Mais capa
💀 Mais kills`
        )
        .setImage(EMBED_SENSI)
        .setColor("Purple");

      return i.reply({
        embeds: [embed],

        components: [
          new ActionRowBuilder().addComponents(

            new ButtonBuilder()
              .setCustomId("sensi")
              .setLabel("COMPRAR")
              .setStyle(ButtonStyle.Success)
          )
        ]
      });
    }

    if (i.commandName === "painelgta") {

      const embed = new EmbedBuilder()
        .setTitle("🚗 CONTA GTA V")
        .setDescription(
`🔥 Conta GTA V completa

💸 Dinheiro
🚘 Veículos
⭐ Benefícios`
        )
        .setImage(EMBED_GTA)
        .setColor("Orange");

      return i.reply({
        embeds: [embed],

        components: [
          new ActionRowBuilder().addComponents(

            new ButtonBuilder()
              .setCustomId("gta")
              .setLabel("COMPRAR")
              .setStyle(ButtonStyle.Danger)
          )
        ]
      });
    }

    if (i.commandName === "rank") {

      const ranking = Object.entries(db.vendas)
        .sort((a, b) => b[1] - a[1])
        .map((x, idx) =>
          `${idx + 1}. <@${x[0]}> - ${x[1]}`
        )
        .join("\n") || "Sem compras";

      return i.reply({
        content: `🏆 Rank\n\n${ranking}`,
        ephemeral: true
      });
    }
  }

  if (i.isButton()) {

    const userId = i.user.id;

    if (db.blacklist[userId]) {

      return i.reply({
        content: "🚫 Usuário bloqueado.",
        ephemeral: true
      });
    }

    const now = Date.now();

    if (
      db.cooldown[userId] &&
      now - db.cooldown[userId] < 3000
    ) {

      return i.reply({
        content: "⏳ Aguarde alguns segundos.",
        ephemeral: true
      });
    }

    db.cooldown[userId] = now;
    salvar();

    if (i.customId.startsWith("copiar_")) {

      const pixId =
        i.customId.split("_")[1];

      return i.reply({
        content:
          db.pix[pixId] || "PIX não encontrado.",
        ephemeral: true
      });
    }

    if (db.tickets[userId]) {

      return i.reply({
        content:
          "❌ Você já possui pagamento aberto.",
        ephemeral: true
      });
    }

    const produtoId = i.customId;

    const produto = PRODUTOS[produtoId];

    if (!produto) return;

    await i.deferReply({ ephemeral: true });

    const pg =
      await gerarPix(produtoId, userId);

    if (
      !pg?.point_of_interaction?.transaction_data
    ) {

      return i.editReply(
        "❌ Erro ao gerar PIX."
      );
    }

    const pix =
      pg.point_of_interaction
        .transaction_data.qr_code;

    const pixId =
      Date.now().toString();

    db.pix[pixId] = pix;
    salvar();

    const canal =
      await i.guild.channels.create({

        name: `ticket-${i.user.username}`,

        parent: CATEGORIA_ID,

        permissionOverwrites: [

          {
            id: i.guild.id,
            deny: [
              PermissionsBitField.Flags.ViewChannel
            ]
          },

          {
            id: userId,
            allow: [
              PermissionsBitField.Flags.ViewChannel
            ]
          }
        ]
      });

    db.tickets[userId] = canal.id;
    salvar();

    const qr =
      `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pix)}`;

    const embed = new EmbedBuilder()
      .setTitle("💳 PAGAMENTO PIX")
      .setDescription(
`📦 Produto: ${produto.nome}
💰 Valor: R$${produto.preco}`
      )
      .setImage(qr)
      .setColor("Green")
      .addFields({
        name: "PIX copia e cola",
        value: `\`\`\`${pix.substring(0, 1000)}\`\`\``
      });

    if (produto.imagem) {
      embed.setThumbnail(produto.imagem);
    }

    await canal.send({

      content:
        `<@${userId}> ⏰ Expira em 12 minutos`,

      embeds: [embed],

      components: [

        new ActionRowBuilder().addComponents(

          new ButtonBuilder()
            .setCustomId(`copiar_${pixId}`)
            .setLabel("📋 Copiar PIX")
            .setStyle(ButtonStyle.Primary)
        )
      ]
    });

    await i.editReply(
      `✅ Ticket criado: ${canal}`
    );

    setTimeout(() => {

      canal.send(
        "⚠️ Seu pagamento expira em 2 minutos."
      ).catch(() => {});

    }, 600000);

    setTimeout(() => {

      if (db.tickets[userId]) {

        delete db.tickets[userId];
        salvar();

        canal.send(
          "❌ Ticket expirado por falta de pagamento."
        ).catch(() => {});

        setTimeout(() => {
          canal.delete().catch(() => {});
        }, 3000);
      }

    }, 720000);
  }
});

app.post("/webhook", (req, res) => {

  res.sendStatus(200);

  setTimeout(async () => {

    try {

      const paymentId =
        req.body?.data?.id;

      if (
        !paymentId ||
        db.entregues[paymentId]
      ) return;

      const pg =
        await payment.get({
          id: paymentId
        });

      if (
        !pg ||
        pg.status !== "approved"
      ) return;

      const userId =
        pg.metadata?.user_id;

      const produtoId =
        pg.metadata?.produto;

      const produto =
        PRODUTOS[produtoId];

      if (!userId || !produto)
        return;

      let entrega =
        produto.tipo === "gta"
          ? contaGtaRandom()
          : produto.link;

      const user =
        await client.users.fetch(userId);

      await user.send({

        content:
`🎉 **COMPRA CONFIRMADA**

📦 Produto: ${produto.nome}
💰 Valor: R$${produto.preco}

🔗 ENTREGA:
${entrega}`
      }).catch(() => {});

      db.entregues[paymentId] = true;

      db.vendas[userId] =
        (db.vendas[userId] || 0) + 1;

      salvar();

      const guilds = client.guilds.cache;

      guilds.forEach(async guild => {

        try {

          const membro =
            await guild.members.fetch(userId)
            .catch(() => null);

          if (membro) {

            await membro.roles.add(
              CARGO_CLIENTE
            ).catch(() => {});
          }

        } catch {}
      });

      const canalId =
        db.tickets[userId];

      if (canalId) {

        const canal =
          await client.channels
            .fetch(canalId)
            .catch(() => null);

        if (canal)
          await canal.delete()
            .catch(() => {});

        delete db.tickets[userId];
        salvar();
      }

      const recentes =
        await client.channels
          .fetch(CANAL_RECENTES)
          .catch(() => null);

      if (recentes) {

        const embed =
          new EmbedBuilder()

          .setAuthor({
            name:
              "🏆 Compra aprovada com sucesso!"
          })

          .setDescription(
`📦 **Produtos adquiridos**
1x - ${produto.nome}

💰 **Valor pago**
R$ ${produto.preco},00

✨ **Avaliação**
⭐⭐⭐⭐⭐ 5 estrelas!`
          )

          .setImage(IMG)

          .setColor("Green");

        await recentes.send({
          embeds: [embed]
        }).catch(() => {});
      }

      const logs =
        await client.channels
          .fetch(CANAL_LOGS)
          .catch(() => null);

      if (logs) {

        await logs.send(
          `✅ Compra confirmada | ${userId} | ${produto.nome}`
        ).catch(() => {});
      }

      await atualizarRank();

    } catch (e) {
      console.log(
        "ERRO WEBHOOK:",
        e
      );
    }

  }, 300);
});

app.listen(process.env.PORT || 3000);

client.login(TOKEN);
