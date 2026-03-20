const {
Client,
GatewayIntentBits,
ButtonBuilder,
ActionRowBuilder,
ButtonStyle,
PermissionsBitField,
EmbedBuilder
} = require("discord.js");

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
]
});

// ===== CONFIG =====

const TOKEN = process.env.TOKEN;

const CATEGORIA_ID = "1466619720487800845";
const CARGO_PERMITIDO = "1466621093799268443";

const PRODUTOS = {

opt5:{
preco:5,
qrcode:"https://cdn.discordapp.com/attachments/1373392385014370334/1483933984965791835/IMG-20260318-WA0011.jpg",
link:"https://www.mediafire.com/file/gas56d3988tfhfl/otimiza%25C3%25A7%25C3%25A3o_basica.rar/file"
},

opt10:{
preco:10,
qrcode:"https://cdn.discordapp.com/attachments/1373392385014370334/1483933984562876501/IMG-20260318-WA0012.jpg",
link:"https://www.mediafire.com/file/98zllqrqqtwe37c/otimiza%25C3%25B5es_diddy.rar/file"
},

opt20:{
preco:20,
qrcode:"https://cdn.discordapp.com/attachments/1373392385014370334/1483933984193908857/IMG-20260318-WA0013.jpg",
link:"https://www.mediafire.com/file/ui6oxugqqo5fv35/OTIMIZI%25C3%2587%25C3%2583O_SUPREMA.rar/file"
}

};

// ==================

client.once("ready",()=>{
console.log(`BOT ONLINE: ${client.user.tag}`);
});

// ===== PAINEL =====

client.on("messageCreate",async msg=>{

if(msg.content === "!painel"){

const embed = new EmbedBuilder()
.setTitle("🚀 Loja de Otimizações")
.setDescription(`
🔧 Básica — R$5
⚡ Avançada — R$10
🔥 Suprema — R$20

Clique no botão abaixo para comprar
`)
.setColor("Green");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("Básica").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("opt10").setLabel("Avançada").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("opt20").setLabel("Suprema").setStyle(ButtonStyle.Danger)
);

msg.channel.send({
embeds:[embed],
components:[row]
});

}

});

// ===== BOTÕES =====

client.on("interactionCreate",async interaction=>{

if(!interaction.isButton())return;

const produto = PRODUTOS[interaction.customId];
if(!produto)return;

// CRIAR TICKET
const canal = await interaction.guild.channels.create({
name:`ticket-${interaction.user.username}`,
type:0,
parent:CATEGORIA_ID,
permissionOverwrites:[
{
id:interaction.guild.id,
deny:[PermissionsBitField.Flags.ViewChannel]
},
{
id:interaction.user.id,
allow:[PermissionsBitField.Flags.ViewChannel]
}
]
});

const embed = new EmbedBuilder()
.setTitle("💳 Pagamento PIX")
.setDescription(`
💰 Valor: **R$${produto.preco}**

Escaneie o QR Code abaixo para pagar.

Depois aguarde um STAFF confirmar o pagamento.
`)
.setImage(produto.qrcode)
.setColor("Green");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId(`confirmar_${interaction.customId}`)
.setLabel("Confirmar Pagamento")
.setStyle(ButtonStyle.Success)
);

canal.send({
content:`<@${interaction.user.id}>`,
embeds:[embed],
components:[row]
});

interaction.reply({
content:`Ticket criado: ${canal}`,
ephemeral:true
});

});

// ===== CONFIRMAR PAGAMENTO (SÓ STAFF) =====

client.on("interactionCreate", async interaction => {

if (!interaction.isButton()) return;

if (!interaction.customId.startsWith("confirmar_")) return;

// VERIFICA CARGO
if (!interaction.member.roles.cache.has(CARGO_PERMITIDO)) {
return interaction.reply({
content: "❌ Você não pode confirmar pagamentos!",
ephemeral: true
});
}

// IDENTIFICA PRODUTO
const idProduto = interaction.customId.split("_")[1];
const produto = PRODUTOS[idProduto];

if (!produto) return;

const usuario = interaction.user;

// ENVIA NA DM
await usuario.send(`
✅ Pagamento confirmado!

📦 Sua otimização:
${produto.link}

🎥 Tutorial:
https://cdn.discordapp.com/attachments/1468729150071377950/1478085121344143440/bandicam_2026-03-02_14-41-04-216.mp4

Obrigado pela compra!
`);

interaction.channel.send("✅ Produto enviado na DM!");

// FECHA TICKET
setTimeout(()=>{
interaction.channel.send("🔒 Fechando ticket...");
setTimeout(()=>{
interaction.channel.delete();
},4000);
},4000);

});

// ===== LOGIN =====

client.login(TOKEN);
