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

// 🔥 PEGA DO RAILWAY (NÃO COLOCA TOKEN AQUI)
const TOKEN = process.env.TOKEN;

const CANAL_VENDAS = "1469443201441071185";
const CATEGORIA_ID = "1466619720487800845";

const PRODUTOS = {

opt5:{
preco:5,
qrcode:"https://cdn.discordapp.com/attachments/1373392385014370334/1483933984965791835/IMG-20260318-WA0011.jpg",
link:"https://www.mediafire.com/file/f12w9j4pz62vymn/otimiza%25C3%25A7%25C3%25A3o_basica.rar/file"
},

opt10:{
preco:10,
qrcode:"https://cdn.discordapp.com/attachments/1373392385014370334/1483933984562876501/IMG-20260318-WA0012.jpg",
link:"https://www.mediafire.com/file/t7knt8i0n2zhjg6/otimizações+diddy.rar/file"
},

opt20:{
preco:20,
qrcode:"https://cdn.discordapp.com/attachments/1373392385014370334/1483933984193908857/IMG-20260318-WA0013.jpg",
link:"https://www.mediafire.com/file/i201pap80rq2vym/OTIMIZIÇÃO+SUPREMA.rar/file"
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

// ===== CRIAR TICKET =====

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

Depois clique em **Confirmar Pagamento**
`)
.setImage(produto.qrcode)
.setColor("Green");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId("confirmar")
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

// ===== CONFIRMAR PAGAMENTO =====

client.on("interactionCreate",async interaction=>{

if(!interaction.isButton())return;

if(interaction.customId !== "confirmar")return;

const usuario = interaction.user;

await usuario.send(`
✅ Pagamento confirmado!

📦 Sua otimização:

LINK_DA_OTIMIZACAO

Obrigado pela compra!
`);

interaction.channel.send("✅ Produto enviado na DM!");

setTimeout(()=>{
interaction.channel.send("🔒 Fechando ticket...");
setTimeout(()=>{
interaction.channel.delete();
},4000);
},4000);

});

// ===== LOGIN =====

client.login(TOKEN);
