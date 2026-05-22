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
const CARGO_CLIENTE = "1494143094327742594";

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
  opt5: { nome: "Otimização Básica", preco: 5, link: "https://www.mediafire.com/file/vb4klwyfxmxt5sa/OTIMIZA.rar" },
  opt10: { nome: "Otimização Avançada", preco: 10, link: "https://www.mediafire.com/file/iidtoou88ozkwll/OTIMIZA2.rar" },
  opt20: { nome: "Otimização Suprema", preco: 20, link: "https://www.mediafire.com/file/61ivdjr64yb9o6t/OTIMIZA3.rar" },
  omega: { nome: "Otimização Omega", preco: 35, link: "https://www.mediafire.com/file/dlrwhlg55bs24yd/OMEGA.rar" },

  sensi: {
    nome: "Pack Sensi",
    preco: 5,
    link: "https://www.mediafire.com/file/n9ykc869wesglg0/sensi.rar",
    imagem: EMBED_SENSI
  },

  fivem: {
    nome: "Pack FiveM",
    preco: 10,
    link: "https://www.mediafire.com/file/5yirnjceinkjoaf/fivem.rar",
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
  new SlashCommandBuilder().setName("painel").setDescription("Painel loja"),
  new SlashCommandBuilder().setName("painelsensi").setDescription("Painel sensi"),
  new SlashCommandBuilder().setName("painelfivem").setDescription("Painel fivem"),
  new SlashCommandBuilder().setName("painelgta").setDescription("Painel gta"),
  new SlashCommandBuilder().setName("rank").setDescription("Rank compras")
].map(c => c.toJSON());

client.once("ready", async () => {
  console.log("BOT ONLINE");

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );

  console.log("COMANDOS OK");
});

function contaGtaRandom() {
  return CONTAS_GTA[Math.floor(Math.random() * CONTAS_GTA.length)];
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
          email: "comprasbot@gmail.com"
        },
        metadata: {
          user_id: userId,
          produto: produtoId
        }
      }
    });

  } catch (e) {
    console.log("ERRO PIX:", e?.response?.data || e);
    return null;
  }
}

client.on("interactionCreate", async (i) => {

  if (i.isChatInputCommand()) {

    if (i.commandName === "painelfivem") {
      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🔥 PACK FIVEM")
            .setImage(EMBED_FIVEM)
            .setColor("Purple")
            .setDescription("🚀 Melhor otimização para FiveM Por apenas 10 Reais")
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

    if (i.commandName === "painel") {
      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("DIDDY STORE")
            .setImage(EMBED_PAINEL)
            .setColor("Purple")
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("opt5").setLabel("5").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("opt10").setLabel("10").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("opt20").setLabel("20").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("omega").setLabel("OMEGA").setStyle(ButtonStyle.Secondary)
          )
        ]
      });
    }

    if (i.commandName === "painelsensi") {
      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("SENSI")
            .setImage(EMBED_SENSI)
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("sensi").setLabel("COMPRAR").setStyle(ButtonStyle.Success)
          )
        ]
      });
    }

    if (i.commandName === "painelgta") {
      return i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("GTA V")
            .setImage(EMBED_GTA)
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("gta").setLabel("COMPRAR").setStyle(ButtonStyle.Danger)
          )
        ]
      });
    }
  }

  if (i.isButton()) {

    const userId = i.user.id;
    const produto = PRODUTOS[i.customId];

    if (!produto) return;

    try {

      await i.deferReply({ ephemeral: true });

      const pg = await gerarPix(i.customId, userId);

      if (!pg?.point_of_interaction?.transaction_data) {
        return i.editReply("❌ erro ao gerar PIX");
      }

      const pix = pg.point_of_interaction.transaction_data.qr_code;

      const canal = await i.guild.channels.create({
        name: `ticket-${i.user.username}`,
        type: ChannelType.GuildText,
        parent: CATEGORIA_ID,
        permissionOverwrites: [
          { id: i.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: userId, allow: [PermissionsBitField.Flags.ViewChannel] }
        ]
      });

      const embed = new EmbedBuilder()
        .setTitle("PIX PAGAMENTO")
        .setDescription(`Produto: ${produto.nome}`)
        .setColor("Green");

      if (produto.imagem) embed.setImage(produto.imagem);

      await canal.send({
        content: `<@${userId}>`,
        embeds: [embed]
      });

      await i.editReply(`Ticket criado: ${canal}`);

    } catch (e) {
      console.log(e);
      i.editReply("❌ erro no ticket");
    }
  }
});

app.listen(3000);
client.login(TOKEN);
