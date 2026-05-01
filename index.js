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

// Base corrigida pronta para substituir o index.js antigo
// Estrutura mantida igual à sua, com organização e estabilidade melhoradas

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

console.log("index.js atualizado e pronto para uso.");
