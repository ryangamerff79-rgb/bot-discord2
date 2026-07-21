const {
  Client,
  GatewayIntentBits,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType,
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

const IMG = "https://cdn.discordapp.com/attachments/1373392385014370334/1497072312413851790/1294723.webp";

const EMBED_PAINEL = "https://cdn.discordapp.com/attachments/1504981948106408182/1506132172321460294/8a0b88a4-3ee0-442f-ad5f-760341da1179.png";

const EMBED_SENSI = "https://cdn.discordapp.com/attachments/1504981948106408182/1506141414252089484/content.png";

const EMBED_GTA = "https://cdn.discordapp.com/attachments/1504981948106408182/1506140642089242644/59f6df83-2b8d-4044-87de-3191a5146e6c.png";

const EMBED_FIVEM = "https://cdn.discordapp.com/attachments/1504948139021308044/1507177686580330586/148c570b-3ece-4d55-bcce-2447520aa7cb.png";

let db = {
  tickets: {},
  pix: {},
  entregues: {},
  vendas: {},
  rankMsg: null
};

if (fs.existsSync("dados.json")) {
  db = JSON.parse(fs.readFileSync("dados.json"));
}

function salvar() {
  fs.writeFileSync(
    "dados.json",
    JSON.stringify(db, null, 2)
  );
}

const mp = new MercadoPagoConfig({
  accessToken: MP_TOKEN
});

const payment = new Payment(mp);

const PRODUTOS = {

  opt5: {
    nome: "Otimização Básica",
    preco: 5,
    link: "https://www.mediafire.com/file/vb4klwyfxmxt5sa/OTIMIZA.rar"
  },

  opt10: {
    nome: "Otimização Avançada",
    preco: 10,
    link: "https://www.mediafire.com/file/tp3frlm67pong3i/OTIMIZA%25C3%2587%25C3%2583O_AVAN%25C3%2587ADA.rar/file"
  },

  opt20: {
    nome: "Otimização Suprema",
    preco: 20,
    link: "https://www.mediafire.com/file/ykunopwmhkmye1z/OTIMIZI%25C3%2587%25C3%2583O_SUPREMA.rar/file"
  },

  omega: {
    nome: "Otimização Omega",
    preco: 35,
    link: "https://www.mediafire.com/file/oklu2dec9o0dk70/OMEGA_PACK.rar/file"
  },

  sensi: {
    nome: "Pack Sensi",
    preco: 5,
    link: "https://www.mediafire.com/file/n9ykc869wesglg0/sensi.rar",
    imagem: EMBED_SENSI
  },

  fivem: {
    nome: "Pack FiveM",
    preco: 10,
    link: "https://www.mediafire.com/file/jo8wbg6d5llua2j/FIVEM_BOOST.rar/file",
    imagem: EMBED_FIVEM
  },

  gta: {
    nome: "Conta GTA V",
    preco: 5,
    tipo: "gta",
    imagem: EMBED_GTA
  }
};

const CONTAS_GTA = [
  "user:senha1",
  "user:senha2"
];

const commands = [

  new SlashCommandBuilder()
    .setName("painel")
    .setDescription("Painel otimizações"),

  new SlashCommandBuilder()
    .setName("painelsensi")
    .setDescription("Painel sensi"),

  new SlashCommandBuilder()
    .setName("painelfivem")
    .setDescription("Painel fivem"),

  new SlashCommandBuilder()
    .setName("painelgta")
    .setDescription("Painel gta"),

  new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Rank compras")

].map(c => c.toJSON());

client.once("ready", async () => {

  console.log("✅ BOT ONLINE");

  const rest = new REST({ version: "10" })
    .setToken(TOKEN);

  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );

  console.log("✅ COMANDOS REGISTRADOS");
});

function contaGtaRandom() {

  return CONTAS_GTA[
    Math.floor(
      Math.random() * CONTAS_GTA.length
    )
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

    console.log("ERRO PIX:", e);
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
      `🏆 TOP COMPRADORES\n\n${ranking}`
    );

  } catch (e) {
    console.log(e);
  }
}

client.on("interactionCreate", async (i) => {

  if (i.isChatInputCommand()) {

    if (i.commandName === "painel") {

      return i.reply({

        embeds: [

          new EmbedBuilder()

            .setTitle("🛒 DIDDY STORE")

            .setDescription(`
🔥 Loja Oficial

⚡ Mais FPS
🎯 Menor Delay
🚀 Melhor Performance
`)

            .setImage(EMBED_PAINEL)

            .setColor("Purple")
        ],

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
              .setStyle(ButtonStyle.Secondary)
          )
        ]
      });
    }

    if (i.commandName === "painelsensi") {

      return i.reply({

        embeds: [

          new EmbedBuilder()

            .setTitle("🎯 PACK SENSI")

            .setDescription(`
🎯 Mais precisão
⚡ Mais capa
🔥 Melhor sensi
`)

            .setImage(EMBED_SENSI)

            .setColor("Purple")
        ],

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

    if (i.commandName === "painelfivem") {

      return i.reply({

        embeds: [

          new EmbedBuilder()

            .setTitle("🔥 PACK FIVEM")

            .setDescription(`
🚀 Melhor pack FiveM
⚡ Mais FPS
🎯 Zero travamentos
💎 Apenas R$10
`)

            .setImage(EMBED_FIVEM)

            .setColor("Purple")
        ],

        components: [

          new ActionRowBuilder().addComponents(

            new ButtonBuilder()
              .setCustomId("fivem")
              .setLabel("COMPRAR")
              .setStyle(ButtonStyle.Primary)
          )
        ]
      });
    }

    if (i.commandName === "painelgta") {

      return i.reply({

        embeds: [

          new EmbedBuilder()

            .setTitle("🚗 CONTA GTA V")

            .setDescription(`
💸 Dinheiro
🚘 Veículos
⭐ Benefícios
`)

            .setImage(EMBED_GTA)

            .setColor("Orange")
        ],

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

        .map((x, i) =>
          `${i + 1}. <@${x[0]}> - ${x[1]}`
        )

        .join("\n") || "Sem compras";

      return i.reply({
        content: `🏆 RANK\n\n${ranking}`,
        ephemeral: true
      });
    }
  }

  if (i.isButton()) {

    if (i.customId.startsWith("copiar_")) {

      const pixId =
        i.customId.split("_")[1];

      return i.reply({

        content:
          db.pix[pixId] || "PIX não encontrado.",

        ephemeral: true
      });
    }

    const userId = i.user.id;

    const produto = PRODUTOS[i.customId];

    if (!produto) return;

    try {

      await i.deferReply({
        ephemeral: true
      });

      const pg =
        await gerarPix(i.customId, userId);

      if (
        !pg?.point_of_interaction?.transaction_data
      ) {

        return i.editReply(
          "❌ erro ao gerar PIX"
        );
      }

      const pix =
        pg.point_of_interaction
          .transaction_data.qr_code;

      const qr =
        `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pix)}`;

      const pixId =
        Date.now().toString();

      db.pix[pixId] = pix;
      salvar();

      const canal =
        await i.guild.channels.create({

          name: `ticket-${i.user.username}`,

          type: ChannelType.GuildText,

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

      const embed = new EmbedBuilder()

        .setTitle("💳 PAGAMENTO PIX")

        .setDescription(`
📦 Produto: ${produto.nome}
💰 Valor: R$${produto.preco}
⏰ Expira em 12 minutos
`)

        .setImage(qr)

        .setColor("Green")

        .addFields({

          name: "📋 PIX Copia e Cola",

          value:
            `\`\`\`${pix.substring(0, 1000)}\`\`\``
        });

      if (produto.imagem) {
        embed.setThumbnail(produto.imagem);
      }

      await canal.send({

        content: `<@${userId}>`,

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

      setTimeout(async () => {

        try {

          const canalExiste =
            await client.channels
              .fetch(canal.id)
              .catch(() => null);

          if (!canalExiste) return;

          await canal.send(
            `⚠️ <@${userId}> faltam apenas 2 minutos para o ticket expirar.`
          );

        } catch {}

      }, 10 * 60 * 1000);

      setTimeout(async () => {

        try {

          const canalExiste =
            await client.channels
              .fetch(canal.id)
              .catch(() => null);

          if (!canalExiste) return;

          if (db.tickets[userId]) {

            delete db.tickets[userId];

            salvar();

            await canal.send(
              `⌛ Ticket expirado. Fechando em 5 segundos...`
            );

            setTimeout(async () => {

              await canal.delete()
                .catch(() => {});

            }, 5000);
          }

        } catch {}

      }, 12 * 60 * 1000);

      await i.editReply(
        `✅ Ticket criado: ${canal}`
      );

    } catch (e) {

      console.log(e);

      i.editReply(
        "❌ erro no ticket"
      );
    }
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
`🎉 COMPRA CONFIRMADA

📦 Produto: ${produto.nome}
💰 Valor: R$${produto.preco}

🔗 ENTREGA:
${entrega}`
      }).catch(() => {});

      db.entregues[paymentId] = true;

      db.vendas[userId] =
        (db.vendas[userId] || 0) + 1;

      salvar();

      const canalId =
        db.tickets[userId];

      if (canalId) {

        const canal =
          await client.channels
            .fetch(canalId)
            .catch(() => null);

        if (canal) {

          await canal.send(
            `✅ Pagamento aprovado! Produto entregue na DM.`
          );

          setTimeout(async () => {

            await canal.delete()
              .catch(() => {});

          }, 5000);
        }

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
                "🏆 Compra aprovada!"
            })

            .setDescription(`
📦 Produto:
${produto.nome}

💰 Valor:
R$${produto.preco}
`)

            .setImage(IMG)

            .setColor("Green");

        await recentes.send({
          embeds: [embed]
        });
      }

      const logs =
  await client.channels
    .fetch(CANAL_LOGS)
    .catch(() => null);

if (logs) {

  const dataCompra = new Date().toLocaleString(
    "pt-BR",
    {
      timeZone: "America/Sao_Paulo"
    }
  );

 const comprador =
(
  pg.payer?.first_name ||
  pg.payer?.last_name
)
? `${pg.payer?.first_name || ""} ${pg.payer?.last_name || ""}`.trim()
: "Não informado";

  const banco =
    pg.payment_method_id ||
    pg.payment_type_id ||
    "PIX";

  const embedLogs = new EmbedBuilder()

    .setTitle("🛒 NOVA VENDA")

    .setColor("Green")

    .setThumbnail(
      "https://cdn-icons-png.flaticon.com/512/3081/3081559.png"
    )

    .addFields(

      {
        name: "👤 Comprador",
        value:
          `${comprador}\n<@${userId}>`,
        inline:false
      },

      {
        name:"🆔 ID Discord",
        value:userId,
        inline:true
      },

      {
        name:"📦 Produto",
        value:produto.nome,
        inline:true
      },

      {
        name:"💰 Valor",
        value:`R$${produto.preco}`,
        inline:true
      },

      {
        name:"🏦 Banco / Método",
        value:banco,
        inline:true
      },

      {
        name:"📅 Data e Hora",
        value:dataCompra,
        inline:true
      },

      {
        name:"💳 Payment ID",
        value:String(paymentId),
        inline:false
      }

    )

    .setFooter({
      text:"Sistema automático"
    })

    .setTimestamp();

  await logs.send({
    embeds:[embedLogs]
  });

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
