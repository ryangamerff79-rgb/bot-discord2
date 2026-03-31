const {
Client,
GatewayIntentBits,
EmbedBuilder,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
PermissionsBitField,
REST,
Routes,
SlashCommandBuilder
} = require("discord.js");

const { MercadoPagoConfig, Payment } = require("mercadopago");
const express = require("express");

const app = express();
app.use(express.json());

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages
]
});

// CONFIG
const TOKEN = process.env.TOKEN;
const MP_TOKEN = process.env.MP_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID; // ID do bot
const GUILD_ID = process.env.GUILD_ID; // ID do servidor

const CARGO_ADMIN = "1466621093799268443";
const CATEGORIA_ID = "1466619720487800845";
const CANAL_LOGS = "1484365314140541078";

// MERCADO PAGO
const mp = new MercadoPagoConfig({ accessToken: MP_TOKEN });
const payment = new Payment(mp);

// CONTAS GTA
const CONTAS_GTA = [
"PODTOPTAP:dream282521",
"gta19710559:85sJzrKnu",
"vykl99911:Leng123?",
"finnickloveschrismas:10011990t",
"halotic21:Ddjac210392",
"msfaraz69:blj55566"
];

// SISTEMA
let totalVendas = 0;
let totalFaturado = 0;
let blacklist = [];

// PRODUTOS
const PRODUTOS = {
opt5:{ preco:5, nome:"Otimização Básica", tipo:"otim" },
opt10:{ preco:10, nome:"Otimização Avançada", tipo:"otim" },
opt20:{ preco:20, nome:"Otimização Suprema", tipo:"otim" },
gta:{ preco:5, nome:"Conta GTA V", tipo:"gta" },
sensi:{ preco:5, nome:"Pack Sensi", tipo:"sensi" }
};

const pagamentos = {};

// ================= SLASH COMMANDS =================

const commands = [
new SlashCommandBuilder().setName("painel").setDescription("Painel de otimizações"),
new SlashCommandBuilder().setName("gta").setDescription("Painel GTA V"),
new SlashCommandBuilder().setName("sensi").setDescription("Painel sensi"),
new SlashCommandBuilder().setName("admin").setDescription("Painel admin"),
new SlashCommandBuilder()
.setName("ban")
.setDescription("Banir usuário")
.addUserOption(o=>o.setName("user").setDescription("Usuário").setRequired(true)),
new SlashCommandBuilder()
.setName("unban")
.setDescription("Desbanir usuário")
.addUserOption(o=>o.setName("user").setDescription("Usuário").setRequired(true)),
new SlashCommandBuilder()
.setName("anunciar")
.setDescription("Enviar anúncio")
.addStringOption(o=>o.setName("msg").setDescription("Mensagem").setRequired(true)),
new SlashCommandBuilder().setName("fechar").setDescription("Fechar ticket")
];

const rest = new REST({ version:"10" }).setToken(TOKEN);

client.once("ready", async ()=>{

await rest.put(
Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
{ body: commands }
);

console.log(`BOT ONLINE: ${client.user.tag}`);
});

// ================= INTERAÇÕES =================

client.on("interactionCreate", async interaction => {

if(interaction.isChatInputCommand()){

// PERMISSÃO ADMIN
const isAdmin = interaction.member.roles.cache.has(CARGO_ADMIN);

// ===== PAINEL =====
if(interaction.commandName === "painel"){

const embed = new EmbedBuilder()
.setTitle("🚀 Otimizações")
.setDescription("Escolha abaixo")
.setColor("Green");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("opt5").setLabel("R$5").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId("opt10").setLabel("R$10").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId("opt20").setLabel("R$20").setStyle(ButtonStyle.Danger)
);

return interaction.reply({embeds:[embed],components:[row]});
}

// ===== GTA =====
if(interaction.commandName === "gta"){

const embed = new EmbedBuilder()
.setTitle("🔥 GTA V R$5")
.setDescription("Conta pronta + entrega automática")
.setColor("Yellow");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("gta").setLabel("Comprar").setStyle(ButtonStyle.Success)
);

return interaction.reply({embeds:[embed],components:[row]});
}

// ===== SENSI =====
if(interaction.commandName === "sensi"){

const embed = new EmbedBuilder()
.setTitle("🎯 SENSI R$5")
.setDescription("Melhor precisão e desempenho")
.setColor("Blue");

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId("sensi").setLabel("Comprar").setStyle(ButtonStyle.Primary)
);

return interaction.reply({embeds:[embed],components:[row]});
}

// ===== ADMIN =====
if(interaction.commandName === "admin"){

if(!isAdmin) return interaction.reply({content:"Sem permissão",ephemeral:true});

return interaction.reply({
content:`💰 Faturado: R$${totalFaturado}\n🧾 Vendas: ${totalVendas}\n🚫 Blacklist: ${blacklist.length}`,
ephemeral:true
});
}

// ===== BAN =====
if(interaction.commandName === "ban"){
if(!isAdmin) return;

const user = interaction.options.getUser("user");
blacklist.push(user.id);

return interaction.reply("Usuário banido");
}

// ===== UNBAN =====
if(interaction.commandName === "unban"){
if(!isAdmin) return;

const user = interaction.options.getUser("user");
blacklist = blacklist.filter(id=>id!==user.id);

return interaction.reply("Usuário desbanido");
}

// ===== ANUNCIAR =====
if(interaction.commandName === "anunciar"){
if(!isAdmin) return;

const msg = interaction.options.getString("msg");

interaction.guild.members.cache.forEach(m=>{
if(!m.user.bot){
m.send(msg).catch(()=>{});
}
});

return interaction.reply("Anúncio enviado");
}

// ===== FECHAR =====
if(interaction.commandName === "fechar"){
if(!isAdmin) return;

interaction.channel.send("Fechando...");

setTimeout(()=>{
interaction.channel.delete().catch(()=>{});
},3000);

}

}

// ================= BOTÕES =================

if(interaction.isButton()){

if(blacklist.includes(interaction.user.id)){
return interaction.reply({content:"🚫 Bloqueado",ephemeral:true});
}

await interaction.deferReply({ephemeral:true});

const produto = PRODUTOS[interaction.customId];

const pagamento = await payment.create({
body:{
transaction_amount: produto.preco,
description: produto.nome,
payment_method_id:"pix",
payer:{ email:`user${interaction.user.id}@gmail.com` }
}
});

const copia = pagamento.point_of_interaction.transaction_data.qr_code;

pagamentos[pagamento.id] = {
userId: interaction.user.id,
produto: produto
};

// criar ticket
const canal = await interaction.guild.channels.create({
name:`ticket-${interaction.user.username}`,
type:0,
parent:CATEGORIA_ID,
permissionOverwrites:[
{ id:interaction.guild.id, deny:[PermissionsBitField.Flags.ViewChannel] },
{ id:interaction.user.id, allow:[PermissionsBitField.Flags.ViewChannel] }
]
});

// embed pagamento
const embed = new EmbedBuilder()
.setTitle("💳 PAGAMENTO PIX")
.setDescription(`Copie abaixo:

\`\`\`
${copia}
\`\`\``)
.setColor("Green");

canal.send({content:`<@${interaction.user.id}>`,embeds:[embed]});

interaction.editReply({content:`Ticket: ${canal}`});
}

});

// ================= WEBHOOK =================

app.post("/webhook", async (req,res)=>{

if(req.body.type === "payment"){

const infoMP = await payment.get({ id:req.body.data.id });

if(infoMP.status === "approved"){

const dados = pagamentos[infoMP.id];
if(!dados)return;

totalVendas++;
totalFaturado += dados.produto.preco;

const user = await client.users.fetch(dados.userId);

// ENTREGA
if(dados.produto.tipo === "gta"){
const conta = CONTAS_GTA[Math.floor(Math.random()*CONTAS_GTA.length)];
user.send(`🎮 Conta:\n${conta}`);
}

if(dados.produto.tipo === "sensi"){
user.send("🎯 https://www.mediafire.com/file/uaevsk3wdui78uw/PACK_SENSI_DIDDY.rar/file");
}

if(dados.produto.tipo === "otim"){
user.send("🚀 Entrega manual");
}

// LOG
const logs = await client.channels.fetch(CANAL_LOGS);

logs.send(`💰 Venda\nProduto: ${dados.produto.nome}\nValor: R$${dados.produto.preco}`);

// AUTO DELETE
setTimeout(()=>{
const canal = client.channels.cache.find(c=>c.name.includes(dados.userId));
if(canal) canal.delete().catch(()=>{});
},20000);

}
}

res.sendStatus(200);
});

app.listen(3000);

client.login(TOKEN);
